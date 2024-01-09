import path from 'node:path'
import fs from 'node:fs'
import { parse as parseImports } from 'es-module-lexer'
import MagicString from 'magic-string'
import type { ImportSpecifier } from 'es-module-lexer'
import type { OutputBundle, OutputChunk, PluginContext } from 'rollup'
import type { ChunkMetadata, IndexHtmlTransformContext, PluginOption, ResolvedConfig } from 'vite'
import { getRandomID, numberToPos } from './utils'

// Extend the Rollup RenderedChunk type with viteMetadata property
declare module 'rollup' {
  export interface RenderedChunk {
    viteMetadata?: ChunkMetadata
  }
}

interface Options {
  cdnDomainPlaceholder?: string
  transformCssSourceURL?: boolean
}

// Preload helper module ID
const preloadHelperId = '\0vite/preload-helper'

// CDN maker placeholder that will be replaced at runtime
const cdnMaker = `__VITE_CDN__`

// Resolved Vite configuration
let config: ResolvedConfig

// Set of dependencies to be loaded
const deps: Set<string> = new Set()

// Need to filter the injected CSS tag collection
const cssTags: Set<string> = new Set()

// Map of CSS file names to their source content
const cssSourceMap: Map<string, string> = new Map()

// Set of imported assets
const importedAssets: Set<string> = new Set()

/**
 * Overwrite the preload helper code
 *
 * @param code string
 * @param id string
 * @returns { code: string, map: SourceMap | null } | undefined
 */
function overwritePreloadHelper(code: string, id: string) {
  // Check if the current module ID matches the preload helper ID
  if (preloadHelperId.includes(id)) {
    let transformCode = code
    // Replace the base path in the code if config.base is set
    if (config.base) {
      transformCode = code.replace(config.base, '')
      const s = new MagicString(transformCode)
      return {
        code: transformCode,
        map: config.build.sourcemap ? s.generateMap({ hires: 'boundary' }) : null,
      }
    }
  }
}

/**
 * Set the CSS tags for the HTML transform context
 *
 * @param ctx IndexHtmlTransformContext
 */
function setCssTags(ctx: IndexHtmlTransformContext) {
  // Map to keep track of analyzed chunks
  const analyzedChunk: Map<OutputChunk, number> = new Map()

  const getCssTagsForChunk = (chunk: OutputChunk, seen: Set<string> = new Set()) => {
    const tags: { filename: string }[] = []
    if (!analyzedChunk.has(chunk)) {
      analyzedChunk.set(chunk, 1)
      // Recursively get CSS tags for imported chunks
      chunk.imports.forEach((file) => {
        const importee = ctx.bundle?.[file]
        if (importee?.type === 'chunk')
          tags.push(...getCssTagsForChunk(importee, seen))
      })
    }

    // Add CSS files imported by the chunk to the tags array
    chunk?.viteMetadata!.importedCss.forEach((file) => {
      if (!seen.has(file)) {
        seen.add(file)
        tags.push({
          filename: file,
        })
      }
    })

    return tags
  }

  // Get CSS tags for entry chunks
  if (ctx.chunk?.type === 'chunk' && ctx.chunk.isEntry) {
    getCssTagsForChunk(ctx.chunk).forEach((cssTag) => {
      cssTags.add(cssTag.filename)
    })
  }
}

/**
 * Set the CSS source content and remove CSS assets from the bundle
 *
 * @param bundle OutputBundle
 */
function setCssSource(bundle: OutputBundle) {
  for (const file in bundle) {
    const chunk = bundle[file]
    if (chunk.type === 'asset' && chunk.fileName.endsWith('.css')) {
      cssSourceMap.set(chunk.fileName, chunk.source as string)
      delete bundle[file]
    }
  }
}

/**
 * Set the imported assets from the bundle
 *
 * @param bundle OutputBundle
 */
function setImportedAssets(bundle: OutputBundle) {
  for (const file in bundle) {
    const chunk = bundle[file]
    if (chunk.type === 'chunk' && chunk?.viteMetadata?.importedAssets.size) {
      chunk.viteMetadata.importedAssets.forEach((asset) => {
        importedAssets.add(asset)
      })
    }
  }
}

/**
 * Inject CSS into JavaScript chunks
 *
 * @param ctx PluginContext
 * @param bundle OutputBundle
 */
function injectCssTojs(ctx: PluginContext, bundle: OutputBundle) {
  // List of emitted CSS files
  const emittedFileList: string[] = []

  for (const file in bundle) {
    const chunk = bundle[file]
    if (chunk.type === 'chunk' && chunk?.viteMetadata?.importedCss.size) {
      const importedCss = Array.from(chunk.viteMetadata.importedCss)
      for (const cssId of importedCss) {
        // Get the CSS code by its ID
        const cssCode = cssSourceMap.get(cssId)
        if (!cssCode)
          continue

        // Check if the CSS ID is in the set of CSS tags
        if (cssTags.has(cssId)) {
          // Emit the CSS file if it hasn't been emitted yet
          if (!emittedFileList.includes(cssId)) {
            emittedFileList.push(cssId)
            ctx.emitFile({ type: 'asset', fileName: cssId, source: cssCode })
          }
        }
        else {
          // Inject the CSS code directly into the JavaScript chunk
          const initialCode = chunk.code
          chunk.code
            = `(function(){ try {var elementStyle = document.createElement('style'); elementStyle.appendChild(document.createTextNode(`
            + `${JSON.stringify(cssCode.trim()).replace(/^"|"$/g, '`')}`
            + `));document.head.appendChild(elementStyle);} catch(e) {console.error('style-injected-by-js', e);} })(); `
            + `${initialCode}`
        }
      }
      // Clear the imported CSS set for the chunk
      chunk.viteMetadata.importedCss.clear()
    }
  }
}

/**
 * Set the dependencies for the bundle
 *
 * @param bundle OutputBundle
 */
function setDeps(ctx: PluginContext, bundle: OutputBundle) {
  for (const file in bundle) {
    const chunk = bundle[file]

    if (chunk.type === 'chunk') {
      const code = chunk.code
      let imports!: ImportSpecifier[]

      try {
        imports = parseImports(code)[0].filter(i => i.d > -1)
      }
      catch (e: any) {
        const loc = numberToPos(code, e.idx)
        ctx.error({
          name: e.name,
          message: e.message,
          stack: e.stack,
          cause: e.cause,
          pos: e.idx,
          loc: { ...loc, file: chunk.fileName },
        })
      }

      if (imports.length) {
        for (let index = 0; index < imports.length; index++) {
          const { n: name, s: start, e: end } = imports[index]
          let url = name
          if (!url) {
            const rawUrl = code.slice(start, end)
            if (rawUrl[0] === `"` && rawUrl[rawUrl.length - 1] === `"`)
              url = rawUrl.slice(1, -1)
          }

          let normalizedFile: string | undefined

          if (url) {
            normalizedFile = path.posix.join(path.posix.dirname(chunk.fileName), url)
            const ownerFilename = chunk.fileName
            const analyzed: Set<string> = new Set<string>()

            // Function to recursively add dependencies
            const addDeps = (filename: string) => {
              if (filename === ownerFilename)
                return
              if (analyzed.has(filename))
                return
              analyzed.add(filename)
              const chunk = bundle[filename]
              if (chunk && chunk.type === 'chunk') {
                // Add the chunk file name to the dependencies
                deps.add(chunk.fileName)
                // Recursively add dependencies for imported chunks
                chunk.imports.forEach(addDeps)
              }
            }

            // Add dependencies for the normalized file
            addDeps(normalizedFile)
          }
        }
      }
    }
  }
}

/**
 * Overwrite the chunk code with CDN URLs
 *
 * @param chunk OutputChunk
 * @returns string
 */
function overwriteChunkCode(chunk: OutputChunk, cdnDomainPlaceholder: string) {
  let code = chunk.code
  // Replace dependencies with CDN URLs
  deps.forEach((dep) => {
    if (code.includes(dep))
      code = code.replace(new RegExp(`"${dep}"`, 'g'), '`' + `${cdnDomainPlaceholder}` + `${config.base}` + `${dep}\``)
  })

  // Replace imported assets with CDN URLs
  if (chunk?.viteMetadata?.importedAssets.size) {
    // Map of CDN file names to their source content
    const cdnSourceMap: Map<string, string> = new Map()

    chunk.viteMetadata.importedAssets.forEach((asset) => {
      if (code.includes(asset) && importedAssets.has(asset)) {
        // Regular expression to match CSS URLs
        const cssUrlRE = new RegExp(
          `(?<=^|[^\\w\-\\u0080-\\uffff])url\\(\[\"|\'\]?\(${config.base}${asset}\(\\?t=\\d+\)?(#.*?)?\)\[\"|\'\]?\(?=\\\)|,|$)`,
        )

        // Replace CSS URLs with CDN URLs
        if (cssUrlRE.test(code)) {
          let match: RegExpExecArray | null
          while ((match = cssUrlRE.exec(code))) {
            const fileName = match[1]
            const randomID = `${cdnMaker}${getRandomID()}`
            cdnSourceMap.set(randomID, fileName)
            code = code.replace(fileName, `${cdnDomainPlaceholder}${randomID}`)
          }
        }

        // Regular expression to match static source URLs
        const staticSourceUrlRE = new RegExp(`${config.base}${asset}`)
        // Replace static source URLs with CDN URLs
        if (staticSourceUrlRE.test(code)) {
          let match: RegExpExecArray | null
          while ((match = staticSourceUrlRE.exec(code))) {
            const fileName = match[0]
            const randomID = `${cdnMaker}${getRandomID()}`
            cdnSourceMap.set(randomID, fileName)
            code = code.replace(
              new RegExp(`\[\"|\'\]?${fileName}\[\"|\'\]?`),
              `\`${cdnDomainPlaceholder}\` + '${randomID}'`,
            )
          }
        }
      }
    })

    if (cdnSourceMap.size) {
      cdnSourceMap.forEach((fileName, key) => {
        code = code.replace(key, fileName)
      })
    }

    cdnSourceMap.clear()
  }

  return code
}

/**
 * Define the Runtime CDN plugin for Vite
 *
 * @returns PluginOption
 */
export function RuntimeCdnPlugin(options: Options = {}): PluginOption {
  const { transformCssSourceURL = false, cdnDomainPlaceholder = '${window.cdn_domain || \'\'}' } = options

  if (!/^\${.*}$/.test(cdnDomainPlaceholder)) {
    throw new Error(
      `The 'cdnDomainPlaceholder' configuration only allows a format like '\${window.cdn_domain || ''}. You need to wrap it using \${}.`,
    )
  }

  return {
    name: `vite:runtime-cdn`,

    enforce: 'post',

    configResolved(resolvedConfig) {
      config = resolvedConfig
    },

    transformIndexHtml: {
      enforce: 'post',
      transform(html, ctx) {
        if (transformCssSourceURL)
          setCssTags(ctx)

        return html
      },
    },

    transform(code, id) {
      const transformResult = overwritePreloadHelper(code, id)
      if (transformResult)
        return transformResult
    },

    generateBundle(_, bundle) {
      if (transformCssSourceURL)
        setCssSource(bundle)

      setImportedAssets(bundle)

      if (transformCssSourceURL)
        injectCssTojs(this, bundle)

      setDeps(this, bundle)
    },

    writeBundle(options, bundle) {
      for (const file in bundle) {
        const chunk = bundle[file]
        if (chunk.type === 'chunk') {
          const filePath = path.resolve(options.dir || '', chunk.fileName)
          const code = overwriteChunkCode(chunk, cdnDomainPlaceholder)
          fs.writeFileSync(filePath, code)
        }
      }
    },
  }
}
