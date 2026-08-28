#!/usr/bin/env node
/**
 * 构建浏览器客户端 bundle：src/client.js → lib/client.js
 *
 * 产物格式与 DSH 客户端模块系统的约定一致（lazy CJS）：
 *
 *   window.__ModuleLoader__.load({
 *     id: "dsh-plugin-question-index",
 *     factory: (require) => { ... }
 *   })
 *
 * 约束：源码是纯 JS（无 JSX/TS），唯一外部导入是 `react`——
 * 由 shell 的客户端模块表提供（`require("react")`），因此本构建
 * 只做「剥 import + 包装」，不做任何转译，零构建依赖。
 *
 * 用法：node scripts/build-client.mjs
 */

import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG_ID = 'dsh-plugin-question-index'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcPath = join(root, 'src', 'client.js')
const outPath = join(root, 'lib', 'client.js')
const hostSrc = join(root, 'src', 'index.js')
const hostOut = join(root, 'lib', 'index.js')

const source = await readFile(srcPath, 'utf8')

// 剥掉唯一的外部 import（react）与 ESM 导出语法，其余代码原样进工厂闭包
// （export 不能出现在函数体内；入口由包装器的 `return { apply }` 提供）。
const importRe = /^import\s+React\s+from\s+'react'\s*\r?\n/m
if (!importRe.test(source)) {
  console.error('build-client: src/client.js 缺少预期的 `import React from \'react\'`，请检查源码头部。')
  process.exit(1)
}
const exportFnRe = /^export\s+function\s+apply\s*\(/m
const exportDefaultRe = /^export\s+default\s+\{\s*apply\s*\}\s*;?\s*$/m
if (!exportFnRe.test(source)) {
  console.error('build-client: src/client.js 缺少 `export function apply(`，请检查源码尾部。')
  process.exit(1)
}
const body = source
  .replace(importRe, '')
  .replace(exportFnRe, 'function apply(')
  .replace(exportDefaultRe, '')

const bundle = `window.__ModuleLoader__.load({
	id: ${JSON.stringify(PKG_ID)},
	factory: (require) => {
		var React = require("react");
${body}
		return { apply };
	}
});
`

await mkdir(dirname(outPath), { recursive: true })
await writeFile(outPath, bundle, 'utf8')
await copyFile(hostSrc, hostOut)
console.log('build-client: wrote', outPath, `(${bundle.length} bytes)`)
console.log('build-client: wrote', hostOut)
