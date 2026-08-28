/**
 * dsh-plugin-question-index — Host 半（装载载体）
 *
 * 本插件是纯 Client UI 插件：全部能力在浏览器端（见 `./client` 导出）。
 * Host 半只作为 Loader 条目载体存在——组合行插入的是这个包名，
 * 宿主侧 ClientModuleRegistry 扫描到 `dsh.client` 声明后自动对外服务
 * `/plugins/<pkg>/client.js` 浏览器 bundle。
 *
 * 这里刻意保持空 apply：不注册任何 Host 服务、不加副作用。
 */

export function apply(_ctx) {
  // 纯客户端插件：Host 半无行为。
}

export default { apply }
