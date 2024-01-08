# vite-plugin-runtime-cdn

[![npm version][npm-version-src]][npm-version-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]

一个支持运行时 CDN 配置的 Vite 插件。

## 安装

> 请确认你的 Vite 版本在 **2.9.0** 以上。

```sh
# pnpm
pnpm add -D vite-plugin-runtime-cdn
# yarn
yarn add -D vite-plugin-runtime-cdn
# npm
npm i -D vite-plugin-runtime-cdn
```

## 使用

```ts
// vite.config.js
import { defineConfig } from 'vite'

// 1. 导入插件
import { RuntimeCdnPlugin } from 'vite-plugin-runtime-cdn'

export default defineConfig({
  plugins: [
    // 2. 添加至插件列表
    RuntimeCdnPlugin(),
  ],
})
```

该插件运行时的 cdn 域名是通过 `window.cdn_domain` 取到的，默认配置为 `${window.cdn_domain || ''}`，所以你需要保证 `window.cdn_domain` 已经在 html 或者其它入口文件已经注入，如果你想修改该配置，你可以传入 `cdnDomainPlaceholder` 参数，但你需要使用 `${}` 进行包裹，如 `${window.myCustomCDNDomain || ''}`。

```ts
// vite.config.js
import { defineConfig } from 'vite'

// 1. 导入插件
import { RuntimeCdnPlugin } from 'vite-plugin-runtime-cdn'

export default defineConfig({
  plugins: [
    // 2. 添加至插件列表
    RuntimeCdnPlugin({
      cdnDomainPlaceholder: `${window.myCustomCDNDomain || ''}`,
    }),
  ],
})
```

该插件默认不会转换 css 文件内部的静态资源（如图片等）引用，如果你想同时将 css 内部的静态资源也转化为运行时 cdn 配置，则需要将 css 注入到各自的 js 模块内部，再变成运行时 cdn 配置，这里将 css 注入至 js 模块参考的是 [`vite-plugin-inject-css-to-js`](https://github.com/Levix/vite-plugin-inject-css-to-js) 插件。

你可以通过配置 `transformCssSourceURL` 参数将 css 内部引用的静态资源转换为运行时 cdn 配置，但请注意，html 入口引用的 css 文件是不允许注入到对应的 js 模块的，具体可以参考 [`Why can't I build all css files into js?`](https://github.com/Levix/vite-plugin-inject-css-to-js?tab=readme-ov-file#why-cant-i-build-all-css-files-into-js)。

```ts
// vite.config.js
import { defineConfig } from 'vite'

// 1. 导入插件
import { RuntimeCdnPlugin } from 'vite-plugin-runtime-cdn'

export default defineConfig({
  plugins: [
    // 2. 添加至插件列表
    RuntimeCdnPlugin({
      transformCssSourceURL: true,
    }),
  ],
})
```

## License

[MIT](./LICENSE) License © [Levix](https://github.com/Levix)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/vite-plugin-runtime-cdn?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/vite-plugin-runtime-cdn
[bundle-src]: https://img.shields.io/bundlephobia/minzip/vite-plugin-runtime-cdn?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=vite-plugin-runtime-cdn
[license-src]: https://img.shields.io/github/license/Levix/vite-plugin-runtime-cdn.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/Levix/vite-plugin-runtime-cdn/blob/main/LICENSE
