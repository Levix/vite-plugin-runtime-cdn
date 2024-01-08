<div align="center">
<h1 align="center">vite-plugin-runtime-cdn</h1>

English / [简体中文](./README_CN.md)

A Vite plugin that supports runtime CDN configuration.

一个支持运行时 CDN 配置的 Vite 插件。

[![npm version][npm-version-src]][npm-version-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]

</div>

## Install

> Make sure your vite version is **2.9.0** or higher.

```sh
# pnpm
pnpm add -D vite-plugin-runtime-cdn
# yarn
yarn add -D vite-plugin-runtime-cdn
# npm
npm i -D vite-plugin-runtime-cdn
```

## Usage

```ts
// vite.config.js
import { defineConfig } from 'vite'

// 1. import the plugin
import { RuntimeCdnPlugin } from 'vite-plugin-runtime-cdn'

export default defineConfig({
  plugins: [
    // 2. add it to the plugins list
    RuntimeCdnPlugin(),
  ],
})
```

The plugin's runtime CDN domain is obtained through `window.cdn_domain`, with the default configuration set to `${window.cdn_domain || ''}`. Therefore, you need to ensure that `window.cdn_domain` has been injected into the HTML or other entry files beforehand. If you want to modify this configuration, you can pass in the `cdnDomainPlaceholder` parameter. However, you need to use `${}` to wrap it, such as `${window.myCustomCDNDomain || ''}`.

```ts
// vite.config.js
import { defineConfig } from 'vite'

// 1. import the plugin
import { RuntimeCdnPlugin } from 'vite-plugin-runtime-cdn'

export default defineConfig({
  plugins: [
    // 2. add it to the plugins list
    RuntimeCdnPlugin({
      cdnDomainPlaceholder: `${window.myCustomCDNDomain || ''}`,
    }),
  ],
})
```

By default, this plugin does not transform static resource references (like images) within CSS files. If you want to also convert static resources inside CSS to runtime CDN configurations, you need to inject the CSS into their respective JS modules, then transforming them into runtime CDN configurations. This approach of injecting CSS into JS modules is based on the [`vite-plugin-inject-css-to-js`](https://github.com/Levix/vite-plugin-inject-css-to-js) plugin.

You can transform static resources referenced inside CSS to runtime CDN configurations by configuring the `transformCssSourceURL` parameter. However, note that CSS files referenced in the HTML entry are not allowed to be injected into corresponding JS modules. For more details, refer to [`Why can't I build all css files into js?`](https://github.com/Levix/vite-plugin-inject-css-to-js?tab=readme-ov-file#why-cant-i-build-all-css-files-into-js).

```ts
// vite.config.js
import { defineConfig } from 'vite'

// 1. import the plugin
import { RuntimeCdnPlugin } from 'vite-plugin-runtime-cdn'

export default defineConfig({
  plugins: [
    // 2. add it to the plugins list
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
