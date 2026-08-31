/**
 * dsh-plugin-question-index — 问题索引（输入框侧边轨道版）
 *
 * 在全局浮层（`shell.overlay`）注册一个贴近聊天输入框的轻量索引轨道：
 * - 展示当前会话的全部提问（含运行中插话发送的「插话」），面板内列表独立滚动
 * - 每个用户问题对应一条短横线，悬停时横线延长并显示问题摘要
 * - 点击任一提问：聊天内容平滑滚动定位到该提问所在行
 *   （对话视图已激活时直接滚动；停在其他视图时先切回对话再滚动）
 *
 * 数据通道（root 作用域的正规读法，零 Host RPC）：
 * - `props.useSessions(s => s.current)` 响应式拿到当前会话 id；
 * - `sessions.binding(id).session` 即 `SessionFace`（`getSnapshot()/subscribe()`），
 *   useEffect 内订阅，随会话切换自动重挂。
 *
 * 跳转桥接（框架无跨视图滚动 API，轻量 DOM 只读）：
 * - 滚动容器：`[data-conversation-scroll]`；行锚点：`data-chat-anchor-key`
 *   （= 聊天节点 key，产品滚动恢复用同一契约）；
 * - 切回对话：头部 `[role="tablist"]` 第一个标签按钮（「对话」固定 order 0），
 *   仅在 `aria-selected !== 'true'` 时点击；
 * - 全程 `typeof document` 守卫，找不到元素静默降级。
 *
 * 视觉：全部颜色取自主题令牌（--dsw-alias-*），透明度衍生一律走
 * `color-mix(in srgb, token, transparent)`，明暗主题自动一致；
 * 先声明实色兜底再叠加 color-mix / backdrop-filter 渐进增强。
 *
 * 平台：Client（web）。
 */

import React from 'react'

const CSS = [
  /* ── 容器：浮层托管规则（不挡下方操作） ── */
  '.qif-wrap{position:absolute;inset:0;pointer-events:none;font-variant-numeric:tabular-nums}',

  /* ── 主聊天区左缘的问题刻度：轨道与原文浮层各自独立滚动 ── */
  '.qif-stage{position:absolute;left:max(16px,calc(50% - 520px));top:50%;transform:translateY(-50%);width:430px;height:42vh;max-height:420px;pointer-events:none}',
  '.qif-rail{position:absolute;inset:0 auto 0 0;width:56px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;touch-action:pan-y;pointer-events:auto;scrollbar-width:thin;scrollbar-color:transparent transparent}',
  '.qif-rail:hover{scrollbar-color:color-mix(in srgb,var(--dsw-alias-label-secondary) 32%,transparent) transparent}',
  '.qif-rail::-webkit-scrollbar{width:3px}',
  '.qif-rail::-webkit-scrollbar-track{background:transparent}',
  '.qif-rail::-webkit-scrollbar-thumb{border-radius:3px;background:transparent}',
  '.qif-rail:hover::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--dsw-alias-label-secondary) 32%,transparent)}',
  '.qif-item{display:flex;align-items:center;width:52px;height:24px;padding:0;margin:0;pointer-events:auto;cursor:pointer;outline:none}',
  '.qif-line{display:block;flex:none;width:24px;height:1.5px;border-radius:2px;background:color-mix(in srgb,var(--dsw-alias-label-secondary) 58%,transparent);transform-origin:left center;transition:width .22s cubic-bezier(.2,.8,.3,1),background .18s ease}',
  '.qif-item:hover .qif-line,.qif-item:focus-visible .qif-line,.qif-item[data-active="true"] .qif-line{width:46px;background:var(--dsw-alias-label-primary)}',
  '.qif-item:active .qif-line{width:42px}',
  '.qif-popupShell{position:absolute;left:62px;top:var(--qif-popup-top,0);transform:translateY(-14px);width:min(360px,calc(100vw - 96px));pointer-events:auto;padding:1px;border-radius:15px;background:linear-gradient(145deg,color-mix(in srgb,var(--dsw-alias-label-primary) 24%,transparent),color-mix(in srgb,var(--dsw-alias-border-l2) 40%,transparent) 42%,color-mix(in srgb,var(--dsw-alias-label-primary) 9%,transparent));box-shadow:0 18px 46px color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent),0 3px 12px color-mix(in srgb,var(--dsw-alias-label-primary) 7%,transparent);animation:qif-popup-in .24s cubic-bezier(.32,.72,0,1)}',
  '.qif-popupShell::before{content:"";position:absolute;inset:1px 18px auto;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--dsw-alias-bg-base) 78%,transparent),transparent);pointer-events:none}',
  '.qif-popup{overflow:hidden;border-radius:14px;background:var(--dsw-alias-bg-overlay);background:color-mix(in srgb,var(--dsw-alias-bg-overlay) 98%,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--dsw-alias-bg-base) 55%,transparent)}',
  '.qif-popupLabel{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 14px 10px;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 56%,transparent);font-size:10px;color:var(--dsw-alias-label-secondary)}',
  '.qif-popupIndex{display:flex;align-items:center;gap:7px;font-weight:650;letter-spacing:.09em}',
  '.qif-popupIndex::before{content:"";width:3px;height:11px;border-radius:2px;background:var(--dsw-alias-brand-primary);box-shadow:0 0 10px color-mix(in srgb,var(--dsw-alias-brand-primary) 38%,transparent)}',
  '.qif-popupTime{font-weight:500;letter-spacing:.025em;white-space:nowrap;opacity:.82}',
  '.qif-popupText{max-height:min(205px,34vh);overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;padding:13px 15px 15px;font-size:12.5px;font-weight:450;line-height:1.72;letter-spacing:.006em;white-space:pre-wrap;overflow-wrap:anywhere;scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--dsw-alias-label-secondary) 28%,transparent) transparent}',
  '.qif-popupText::selection{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent)}',
  '.qif-popupText::-webkit-scrollbar{width:4px}',
  '.qif-popupText::-webkit-scrollbar-track{background:transparent}',
  '.qif-popupText::-webkit-scrollbar-thumb{border-radius:4px;background:color-mix(in srgb,var(--dsw-alias-label-secondary) 28%,transparent)}',
  '@keyframes qif-popup-in{from{opacity:0;transform:translate(-9px,-14px) scale(.975)}to{opacity:1;transform:translate(0,-14px) scale(1)}}',
  '@media(max-width:900px){.qif-stage{left:14px;width:360px}.qif-popupShell{width:min(292px,calc(100vw - 92px))}}',
  '@media(prefers-reduced-motion:reduce){.qif-line{transition:none}.qif-popupShell{animation:none}}',
  /* ── 交接菜单项：注入到宿主原生菜单底部 ── */
  '.qif-handoffItem{box-sizing:border-box;width:100%;min-height:38px;display:flex;align-items:center;gap:10px;padding:0 14px;border:0;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;font:inherit;font-size:12.5px;font-weight:500;letter-spacing:.01em;transition:background .14s ease,color .14s ease}.qif-handoffIcon{width:18px;height:18px;display:block;flex:none;color:var(--dsw-alias-label-secondary);transition:color .14s ease,transform .14s ease}.qif-handoffItem:hover{background:var(--dsw-alias-interactive-bg-hover)}.qif-handoffItem:hover .qif-handoffIcon{color:var(--dsw-alias-brand-primary);transform:translateX(1.5px)}.qif-handoffItem:focus-visible{outline:none;background:var(--dsw-alias-interactive-bg-hover);box-shadow:inset 0 0 0 1.5px var(--dsw-alias-brand-primary)}',

  /* ── 交接对话框：渐变描边 + 顶部高光 + 多层投影，质感向 qif-popupShell 看齐 ── */
  '.qif-handoffMask{position:fixed;inset:0;z-index:220;display:grid;place-items:center;pointer-events:auto;background:color-mix(in srgb,var(--dsw-alias-label-primary) 52%,transparent);backdrop-filter:blur(10px) saturate(140%);-webkit-backdrop-filter:blur(10px) saturate(140%);animation:qif-mask-in .22s ease-out}',
  '.qif-handoffDialog{position:relative;box-sizing:border-box;width:min(500px,calc(100vw - 48px));padding:1px;border-radius:16px;background:linear-gradient(145deg,color-mix(in srgb,var(--dsw-alias-label-primary) 28%,transparent),color-mix(in srgb,var(--dsw-alias-border-l2) 48%,transparent) 42%,color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent));box-shadow:0 32px 80px color-mix(in srgb,var(--dsw-alias-label-primary) 32%,transparent),0 8px 24px color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent),inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-bg-base) 14%,transparent);animation:qif-dialog-in .28s cubic-bezier(.32,.72,0,1)}',
  '.qif-handoffDialog::before{content:"";position:absolute;inset:1px 22px auto;height:1px;border-radius:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--dsw-alias-bg-base) 82%,transparent),transparent);pointer-events:none;opacity:.7}',
  '.qif-handoffDialog::after{content:"";position:absolute;inset:auto 22px 1px;height:1px;border-radius:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent),transparent);pointer-events:none}',
  '.qif-handoffInner{position:relative;box-sizing:border-box;padding:22px 26px 24px;border-radius:15px;background:var(--dsw-alias-bg-overlay);background:color-mix(in srgb,var(--dsw-alias-bg-overlay) 98%,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--dsw-alias-bg-base) 60%,transparent)}',

  /* ── 标题区：品牌色短杠 + 图标 + 强对比字重 ── */
  '.qif-handoffHeader{display:flex;align-items:center;gap:10px;margin:0 0 6px;padding:0;font-size:11px;font-weight:650;letter-spacing:.12em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}',
  '.qif-handoffHeader::before{content:"";width:3px;height:11px;border-radius:2px;background:var(--dsw-alias-brand-primary);box-shadow:0 0 10px color-mix(in srgb,var(--dsw-alias-brand-primary) 44%,transparent)}',
  '.qif-handoffTitle{margin:0 0 10px;font-size:18px;font-weight:600;letter-spacing:-.005em;color:var(--dsw-alias-label-primary);line-height:1.3}',
  '.qif-handoffDesc{margin:0 0 20px;color:var(--dsw-alias-label-secondary);font-size:12.5px;font-weight:450;line-height:1.7;letter-spacing:.005em}',

  /* ── 表单：标签 + 选择器；强化对比与聚焦态 ── */
  '.qif-handoffLabel{display:flex;align-items:center;justify-content:space-between;margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-primary)}',
  '.qif-handoffLabelHint{margin-left:auto;font-size:10.5px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}',
  '.qif-handoffSelect{box-sizing:border-box;width:100%;height:40px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;cursor:pointer;transition:border-color .14s ease,box-shadow .14s ease,background .14s ease;appearance:none;-webkit-appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--dsw-alias-label-secondary) 50%),linear-gradient(135deg,var(--dsw-alias-label-secondary) 50%,transparent 50%);background-position:calc(100% - 18px) 50%,calc(100% - 13px) 50%;background-size:5px 5px,5px 5px;background-repeat:no-repeat;padding-right:34px}',
  '.qif-handoffSelect:hover{border-color:color-mix(in srgb,var(--dsw-alias-label-primary) 24%,var(--dsw-alias-border-l2))}',
  '.qif-handoffSelect:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent)}',
  'body[data-ds-dark-theme] .qif-handoffMask{background:rgba(5,6,8,.72);color-scheme:dark}',
  'body[data-ds-dark-theme] .qif-handoffDialog{background:linear-gradient(145deg,#484b54,#30333a 42%,#25272c);box-shadow:0 32px 80px rgba(0,0,0,.56),0 8px 24px rgba(0,0,0,.38),inset 0 0 0 1px rgba(255,255,255,.035)}',
  'body[data-ds-dark-theme] .qif-handoffInner{background:#202226;color:#f1f2f4;box-shadow:inset 0 1px 0 rgba(255,255,255,.055)}',
  'body[data-ds-dark-theme] .qif-handoffSelect{border-color:#3b3e46;background-color:#191b1f;color:#f1f2f4;color-scheme:dark}',
  'body[data-ds-dark-theme] .qif-handoffSelect option,body[data-ds-dark-theme] .qif-handoffSelect optgroup{background:#202226;color:#f1f2f4}',
  '.qif-agentSelect{position:relative}',
  '.qif-agentSelectTrigger{box-sizing:border-box;width:100%;height:40px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:500;line-height:1;cursor:pointer;text-align:left;transition:border-color .14s ease,box-shadow .14s ease,background .14s ease}',
  '.qif-agentSelectTrigger:hover{border-color:color-mix(in srgb,var(--dsw-alias-label-primary) 24%,var(--dsw-alias-border-l2))}',
  '.qif-agentSelectTrigger:focus-visible,.qif-agentSelectTrigger[aria-expanded="true"]{outline:none;border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent)}',
  '.qif-agentSelectChevron{width:7px;height:7px;flex:none;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:translateY(-2px) rotate(45deg);color:var(--dsw-alias-label-secondary);transition:transform .16s ease}',
  '.qif-agentSelectTrigger[aria-expanded="true"] .qif-agentSelectChevron{transform:translateY(2px) rotate(225deg)}',
  '.qif-agentSelectMenu{position:absolute;z-index:4;left:0;right:0;top:calc(100% + 6px);box-sizing:border-box;max-height:min(240px,38vh);overflow-y:auto;padding:5px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-overlay);box-shadow:0 18px 44px color-mix(in srgb,var(--dsw-alias-label-primary) 20%,transparent)}',
  '.qif-agentSelectOption{box-sizing:border-box;width:100%;min-height:34px;display:flex;align-items:center;gap:9px;padding:6px 9px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:500;line-height:1.35;cursor:pointer;text-align:left}',
  '.qif-agentSelectOption::before{content:"";width:5px;height:9px;flex:none;border-right:1.5px solid transparent;border-bottom:1.5px solid transparent;transform:rotate(45deg)}',
  '.qif-agentSelectOption[aria-selected="true"]::before{border-color:var(--dsw-alias-brand-primary)}',
  '.qif-agentSelectOption:hover,.qif-agentSelectOption:focus-visible{outline:none;background:var(--dsw-alias-interactive-bg-hover)}',
  'body[data-ds-dark-theme] .qif-agentSelectTrigger{border-color:#3b3e46;background:#191b1f;color:#f1f2f4}',
  'body[data-ds-dark-theme] .qif-agentSelectMenu{border-color:#3b3e46;background:#202226;box-shadow:0 22px 54px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.05)}',
  'body[data-ds-dark-theme] .qif-agentSelectOption{color:#e7e8eb}',
  'body[data-ds-dark-theme] .qif-agentSelectOption:hover,body[data-ds-dark-theme] .qif-agentSelectOption:focus-visible{background:#30333a}',

  /* ── 错误条：左侧色条 + 背景微红，提高可读性 ── */
  '.qif-handoffError{margin:14px 0 0;padding:9px 12px;border-radius:8px;border-left:2px solid var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);color:var(--dsw-alias-state-error-primary);font-size:12px;font-weight:500;line-height:1.55}',

  /* ── 按钮组：底部细线分隔，行动按钮品牌色 + 悬浮抬升 ── */
  '.qif-handoffActions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px;padding-top:16px;border-top:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 50%,transparent)}',
  '.qif-handoffButton{position:relative;height:36px;padding:0 18px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12.5px;font-weight:550;letter-spacing:.015em;cursor:pointer;transition:border-color .14s ease,background .14s ease,color .14s ease,box-shadow .14s ease,transform .12s ease}',
  '.qif-handoffButton:hover{border-color:color-mix(in srgb,var(--dsw-alias-label-primary) 30%,var(--dsw-alias-border-l2));background:var(--dsw-alias-interactive-bg-hover)}',
  '.qif-handoffButton:active{transform:translateY(1px)}',
  '.qif-handoffButton:focus-visible{outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent)}',
  '.qif-handoffButton[data-primary="true"]{border-color:transparent;background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);box-shadow:0 6px 18px color-mix(in srgb,var(--dsw-alias-brand-primary) 34%,transparent),inset 0 1px 0 color-mix(in srgb,var(--dsw-alias-bg-base) 22%,transparent)}',
  '.qif-handoffButton[data-primary="true"]:hover{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 92%,var(--dsw-alias-label-primary));box-shadow:0 10px 26px color-mix(in srgb,var(--dsw-alias-brand-primary) 44%,transparent),inset 0 1px 0 color-mix(in srgb,var(--dsw-alias-bg-base) 26%,transparent);transform:translateY(-1px)}',
  '.qif-handoffButton[data-primary="true"]:active{transform:translateY(0);box-shadow:0 4px 12px color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,transparent),inset 0 1px 0 color-mix(in srgb,var(--dsw-alias-bg-base) 22%,transparent)}',
  '.qif-handoffButton:disabled{opacity:.42;cursor:not-allowed;pointer-events:none;box-shadow:none;transform:none}',
  'body[data-ds-dark-theme] .qif-handoffButton:not([data-primary="true"]){border-color:#3b3e46;background:#26282d;color:#d6d8dd}',
  'body[data-ds-dark-theme] .qif-handoffButton:not([data-primary="true"]):hover{background:#30333a;border-color:#50545e}',

  /* ── 动画：遮罩淡入 + 弹框缩放入场 ── */
  '@keyframes qif-mask-in{from{opacity:0}to{opacity:1}}',
  '@keyframes qif-dialog-in{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}',
  '@media(max-width:900px){.qif-handoffDialog{width:min(440px,calc(100vw - 32px))}.qif-handoffInner{padding:20px 22px 22px}}',
  '@media(prefers-reduced-motion:reduce){.qif-handoffMask,.qif-handoffDialog{animation:none}}',
].join('')

/**
 * 插入插件自有样式。两种运行环境都兼容：
 * - 动态插件评估作用域注入了 `styles` 内建（styles.insert 自带 Fiber 生命周期）；
 * - 静态组合装载时降级为插件自有的 `<style data-plugin>` 标签
 *   （与 client-hmr 的插件样式所有权语义一致：卸载时移除自己的标签）。
 */
function insertStyles(css) {
  if (typeof styles !== 'undefined' && styles !== null && typeof styles.insert === 'function') {
    return styles.insert(css)
  }
  if (typeof document === 'undefined') return function () {}
  const TAG_ID = 'dsh-plugin-question-index'
  let tag = document.getElementById(TAG_ID)
  if (tag === null) {
    tag = document.createElement('style')
    tag.id = TAG_ID
    tag.setAttribute('data-plugin', 'question-index')
    if (document.head !== null) document.head.appendChild(tag)
  }
  tag.textContent = css
  return function () {
    if (tag !== null && tag.parentNode !== null) tag.parentNode.removeChild(tag)
  }
}

/** 用户消息 content 块 → 纯文本（只认 text 块；图片提问由 hasImage 标记）。 */
function textFromUserContent(content) {
  if (!Array.isArray(content)) return ''
  let out = ''
  for (const b of content) {
    if (b && b.type === 'text' && typeof b.text === 'string') out += (out === '' ? '' : '\n') + b.text
  }
  return out
}

function sessionIdFromTreeRow(row, sessionState) {
  const byId = sessionState && sessionState.byId
  if (!byId) return ''
  // Prefer any native data attribute if a host version exposes one.
  for (const attr of row.attributes || []) {
    if (!/(?:session|item|node|value).*id|^data-id$/i.test(attr.name)) continue
    if (typeof attr.value === 'string' && byId[attr.value]) return attr.value
  }
  const rowText = String(row.textContent || '').replace(/\s+/g, ' ').trim()
  const ids = Array.isArray(sessionState.ids) ? sessionState.ids : Object.keys(byId)
  const candidates = ids.filter(function (id) {
    const item = byId[id]
    const title = item && String(item.displayTitle || item.title || '').trim()
    return title !== '' && (rowText === title || rowText.startsWith(title + ' ') || rowText.includes(title))
  })
  if (candidates.length <= 1) return candidates[0] || ''

  // Duplicate titles are resolved by the stable order shared by the session
  // store and visible tree rows, without synthesizing drag events.
  const title = String(byId[candidates[0]].displayTitle || byId[candidates[0]].title || '').trim()
  const matchingRows = Array.from(document.querySelectorAll('[role="treeitem"]')).filter(function (item) {
    const text = String(item.textContent || '').replace(/\s+/g, ' ').trim()
    return text === title || text.startsWith(title + ' ') || text.includes(title)
  })
  const index = matchingRows.indexOf(row)
  return candidates[Math.max(0, index)] || candidates[0]
}

function trajectoryText(value, depth) {
  if (depth > 6 || value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(function (item) { return trajectoryText(item, depth + 1) }).filter(Boolean).join('\n')
  if (typeof value !== 'object') return ''
  const preferred = ['text', 'content', 'message', 'output', 'result', 'name', 'input', 'arguments']
  const parts = []
  for (const key of preferred) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      const text = trajectoryText(value[key], depth + 1).trim()
      if (text !== '' && !parts.includes(text)) parts.push(text)
    }
  }
  return parts.join('\n')
}

/** Export exactly the ordered nodes rendered by the trajectory view. */
function extractTrajectory(snapshot) {
  const chat = snapshot && snapshot.chat
  const store = chat && chat.nodes
  if (!store || typeof store.get !== 'function' || !Array.isArray(chat.order)) return ''
  const sections = []
  for (const key of chat.order) {
    const node = typeof key === 'string' ? store.get(key) : null
    if (!node || node.visibility === 'hidden') continue
    const data = node.data && typeof node.data === 'object' ? node.data : {}
    const role = String(data.kind || node.kind || 'event').toUpperCase()
    const text = trajectoryText(data, 0).trim()
    if (text !== '') sections.push('## ' + role + '\n\n' + text)
  }
  return sections.join('\n\n')
}

function loadHandoffAgents() {
  const fallback = [
    { id: 'claude', name: 'Claude', command: 'claude', args: '', enabled: true },
    { id: 'codex', name: 'Codex', command: 'codex', args: '', enabled: true },
  ]
  try {
    // Migrate once from the pre-rename key so user-configured agents survive
    // the dsh-plugin-terminal-tab → dsh-plugin-terminal-agent namespace change.
    const legacy = JSON.parse(localStorage.getItem('dsh-terminal-tab:agents') || 'null')
    if (Array.isArray(legacy) && legacy.length > 0) {
      try { localStorage.setItem('dsh-terminal-agent:agents', JSON.stringify(legacy)) } catch (e) {}
      try { localStorage.removeItem('dsh-terminal-tab:agents') } catch (e) {}
    }
    const saved = JSON.parse(localStorage.getItem('dsh-terminal-agent:agents') || 'null')
    if (Array.isArray(saved)) return saved.filter(function (item) { return item && item.enabled !== false && typeof item.command === 'string' })
  } catch (error) {}
  return fallback
}

function shellQuote(value) { return "'" + String(value).replace(/'/g, "'\\''") + "'" }

/**
 * 从会话快照的 chat 视图提取问题索引：
 * user/steering 节点的 key 即聊天行锚点（rowKey），assistant 节点统计工具调用数。
 */
function extractQuestions(chat) {
  const store = chat && chat.nodes
  if (!store || typeof store.get !== 'function' || !Array.isArray(chat.order)) return []
  const questions = []
  let current = null
  for (const key of chat.order) {
    const node = typeof key === 'string' ? store.get(key) : null
    if (!node || typeof node.kind !== 'string' || node.visibility === 'hidden') continue
    const data = node.data && typeof node.data === 'object' ? node.data : {}
    if (node.kind === 'user' || node.kind === 'steering') {
      current = {
        idx: questions.length,
        rowKey: key,
        kind: node.kind,
        time: typeof data.time === 'number' ? data.time : 0,
        text: textFromUserContent(data.content),
        hasImage: Array.isArray(data.content) && data.content.some(function (b) { return !!b && b.type === 'image' }),
        toolCalls: 0,
      }
      questions.push(current)
    } else if (node.kind === 'assistant' && current !== null) {
      const blocks = Array.isArray(data.blocks) ? data.blocks : []
      for (const b of blocks) {
        if (b && b.kind === 'tool-call') current.toolCalls += 1
      }
    }
  }
  return questions
}

function formatQuestionTime(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '--'
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '--'
  const pad = function (value) { return String(value).padStart(2, '0') }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' '
    + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
}

/**
 * 点击跳转工厂。轮询用 `timer` 服务（Fiber 所有），80ms × 25 次上限；
 * 连续点击通过 token 取消上一轮询链。
 */
function createJump(ctx) {
  const timer = ctx.get('timer')
  let jumpToken = 0
  let pendingDisposer = null

  function cancelPendingJump() {
    if (pendingDisposer !== null) {
      pendingDisposer()
      pendingDisposer = null
    }
  }

  function scrollRowIntoView(scroll, row) {
    try {
      const top = row.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop - Math.max(60, scroll.clientHeight * 0.25)
      scroll.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    } catch (e) {
      try {
        scroll.scrollTop = Math.max(0, row.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop - 80)
      } catch (e2) {}
    }
  }

  return function jumpToQuestion(rowKey) {
    if (typeof document === 'undefined') return
    cancelPendingJump()
    jumpToken += 1
    const token = jumpToken

    let scroll = null
    try { scroll = document.querySelector('[data-conversation-scroll]') } catch (e) { scroll = null }
    if (scroll === null) return

    // 头部第一个标签按钮是「对话」（order 0）；已激活则不点击，直接滚动。
    let container = scroll.parentElement
    let tab = null
    for (let level = 0; level < 3 && container !== null && tab === null; level++) {
      let tablist = null
      try { tablist = container.querySelector('[role="tablist"]') } catch (e) { tablist = null }
      if (tablist !== null) tab = tablist.querySelector('button[role="tab"]')
      container = container.parentElement
    }
    if (tab !== null) {
      const selected = typeof tab.getAttribute === 'function' ? tab.getAttribute('aria-selected') : null
      if (selected !== 'true') tab.click()
    }

    if (typeof rowKey !== 'string' || rowKey === '' || timer === undefined || typeof timer.timeout !== 'function') return
    let tries = 0
    const attempt = function () {
      pendingDisposer = null
      if (token !== jumpToken) return
      let scrollNow = null
      try { scrollNow = document.querySelector('[data-conversation-scroll]') } catch (e) { scrollNow = null }
      let row = null
      if (scrollNow !== null) {
        let rows = []
        try { rows = scrollNow.querySelectorAll('[data-chat-anchor-key]') } catch (e) { rows = [] }
        for (const r of rows) {
          if (r.dataset && r.dataset.chatAnchorKey === rowKey) { row = r; break }
        }
      }
      if (row === null) {
        tries += 1
        if (tries > 25) return
        pendingDisposer = timer.timeout(attempt, 80)
        return
      }
      scrollRowIntoView(scrollNow, row)
    }
    pendingDisposer = timer.timeout(attempt, 80)
  }
}

/** 找到会话头部的「对话」Tab；首个 Tab 是对话视图是宿主的固定契约。 */
function findConversationTab() {
  if (typeof document === 'undefined') return null
  let tablists = []
  try { tablists = document.querySelectorAll('[role="tablist"]') } catch (e) { return null }
  let fallback = null
  for (const tablist of tablists) {
    let tab = null
    try { tab = tablist.querySelector('button[role="tab"]') } catch (e) { tab = null }
    if (tab === null) continue
    if (fallback === null) fallback = tab
    const label = typeof tab.textContent === 'string' ? tab.textContent.trim() : ''
    if (label === '对话') return tab
  }
  return fallback
}

function HandoffAgentSelect(props) {
  const rootRef = React.useRef(null)
  const openState = React.useState(false)
  const open = openState[0]
  const setOpen = openState[1]
  const selected = props.agents.find(function (agent) { return agent.id === props.value }) || props.agents[0] || null
  React.useEffect(function () {
    if (!open || typeof document === 'undefined') return
    const dismiss = function (event) {
      if (rootRef.current !== null && !rootRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return function () { document.removeEventListener('pointerdown', dismiss) }
  }, [open])
  const move = function (offset) {
    if (props.agents.length === 0) return
    const current = Math.max(0, props.agents.findIndex(function (agent) { return agent.id === (selected && selected.id) }))
    const next = props.agents[(current + offset + props.agents.length) % props.agents.length]
    props.onChange(next.id)
  }
  return React.createElement('div', { className: 'qif-agentSelect', ref: rootRef },
    React.createElement('button', {
      type: 'button', className: 'qif-agentSelectTrigger',
      'aria-haspopup': 'listbox', 'aria-expanded': String(open), disabled: props.agents.length === 0,
      onClick: function () { setOpen(!open) },
      onKeyDown: function (event) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); move(event.key === 'ArrowDown' ? 1 : -1); setOpen(true) }
        else if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
      },
    },
      React.createElement('span', null, selected ? selected.name : '暂无可用智能体'),
      React.createElement('span', { className: 'qif-agentSelectChevron', 'aria-hidden': 'true' })),
    open ? React.createElement('div', { className: 'qif-agentSelectMenu', role: 'listbox', 'aria-label': '选择智能体' },
      props.agents.map(function (agent) {
        return React.createElement('button', {
          type: 'button', key: agent.id, role: 'option', className: 'qif-agentSelectOption',
          'aria-selected': String(selected !== null && selected.id === agent.id),
          onClick: function () { props.onChange(agent.id); setOpen(false) },
          onKeyDown: function (event) { if (event.key === 'Escape') { event.preventDefault(); setOpen(false) } },
        }, agent.name)
      })) : null)
}

function QuestionIndexOverlay(props, sessions, jumpToQuestion) {
  if (typeof props.useSessions !== 'function') return null
  const sessionState = props.useSessions(function (s) { return s })
  const currentId = sessionState.current
  const snapState = React.useState(null)
  const snap = snapState[0]
  const setSnap = snapState[1]
  const activeState = React.useState(null)
  const activeIndex = activeState[0]
  const setActiveIndex = activeState[1]
  const popupTopState = React.useState(0)
  const popupTop = popupTopState[0]
  const setPopupTop = popupTopState[1]
  const visibleState = React.useState(false)
  const conversationVisible = visibleState[0]
  const setConversationVisible = visibleState[1]
  const handoffState = React.useState(null)
  const handoffSessionId = handoffState[0]
  const setHandoffSessionId = handoffState[1]
  const agentState = React.useState('')
  const handoffAgentId = agentState[0]
  const setHandoffAgentId = agentState[1]
  const handoffBusyState = React.useState(false)
  const handoffBusy = handoffBusyState[0]
  const setHandoffBusy = handoffBusyState[1]
  const handoffErrorState = React.useState('')
  const handoffError = handoffErrorState[0]
  const setHandoffError = handoffErrorState[1]
  const menuSessionRef = React.useRef('')
  const menuRowRef = React.useRef(null)

  // 当前会话的对话快照订阅：随会话切换自动重挂（currentId 是唯一依赖）。
  React.useEffect(function () {
    if (typeof currentId !== 'string' || currentId === '') { setSnap(null); return }
    const binding = sessions !== undefined && sessions !== null && typeof sessions.binding === 'function' ? sessions.binding(currentId) : null
    const session = binding !== null && binding !== undefined ? binding.session : null
    if (session === null || typeof session.getSnapshot !== 'function' || typeof session.subscribe !== 'function') { setSnap(null); return }
    const sync = function () { setSnap(session.getSnapshot()) }
    sync()
    return session.subscribe(sync)
  }, [currentId])

  // shell.overlay 跨所有页签存在；监听宿主 Tab 的 aria-selected，只在「对话」页展示。
  React.useEffect(function () {
    if (typeof document === 'undefined') return
    const syncVisibility = function () {
      const tab = findConversationTab()
      const visible = tab !== null && tab.getAttribute('aria-selected') === 'true'
      setConversationVisible(visible)
      if (!visible) setActiveIndex(null)
    }
    syncVisibility()
    if (typeof MutationObserver === 'undefined' || document.documentElement === null) return
    const observer = new MutationObserver(syncVisibility)
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-selected'],
    })
    return function () { observer.disconnect() }
  }, [])

  // The host currently exposes no session-menu slot. Track the tree row whose
  // overflow button opened the native menu, then append one owned menu item.
  React.useEffect(function () {
    if (typeof document === 'undefined') return
    const rememberSession = function (event) {
      const row = event.target && typeof event.target.closest === 'function' ? event.target.closest('[role="treeitem"]') : null
      if (row === null) return
      const id = row.dataset.qifSessionId || sessionIdFromTreeRow(row, sessionState)
      if (id !== '' && sessionState.byId && sessionState.byId[id]) {
        row.dataset.qifSessionId = id
        menuSessionRef.current = id
        menuRowRef.current = row
      }
    }
    const enhanceMenus = function () {
      const menus = document.querySelectorAll('[role="menu"]')
      for (const menu of menus) {
        if (menu.querySelector('[data-qif-handoff-action]')) continue
        const text = menu.textContent || ''
        if (!/重命名/.test(text) || !/归档/.test(text)) continue
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'qif-handoffItem'
        button.setAttribute('role', 'menuitem')
        button.setAttribute('data-qif-handoff-action', '1')
        button.innerHTML = '<svg class="qif-handoffIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="5" cy="12" r="2.25" stroke="currentColor" stroke-width="1.8"></circle><circle cx="19" cy="12" r="2.25" stroke="currentColor" stroke-width="1.8"></circle><path d="M8 12h7.5M12.5 8.5 16 12l-3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg><span>交接</span>'
        button.onclick = function (event) {
          event.preventDefault()
          event.stopPropagation()
          const id = menuSessionRef.current
          if (id === '') return
          const agents = loadHandoffAgents()
          setHandoffAgentId(agents[0] ? agents[0].id : '')
          setHandoffError('')
          setHandoffSessionId(id)
          // Never remove the host's React-owned menu node directly. Ask the
          // native menu to close through its normal keyboard path so React
          // remains the sole owner of mounting and unmounting that subtree.
          window.setTimeout(function () {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))
          }, 0)
        }
        menu.appendChild(button)
      }
    }
    document.addEventListener('pointerdown', rememberSession, true)
    const observer = new MutationObserver(enhanceMenus)
    observer.observe(document.body, { childList: true, subtree: true })
    return function () {
      observer.disconnect()
      document.removeEventListener('pointerdown', rememberSession, true)
      for (const item of document.querySelectorAll('[data-qif-handoff-action]')) item.remove()
    }
  }, [sessionState])

  async function confirmHandoff() {
    if (handoffSessionId === null || handoffBusy) return
    const agents = loadHandoffAgents()
    const agent = agents.find(function (item) { return item.id === handoffAgentId }) || agents[0]
    const item = sessionState.byId && sessionState.byId[handoffSessionId]
    const binding = sessions && typeof sessions.binding === 'function' ? sessions.binding(handoffSessionId) : null
    const session = binding && binding.session
    if (!agent || !item || !session || typeof session.getSnapshot !== 'function') {
      setHandoffError('无法读取该会话或没有可用智能体')
      return
    }
    setHandoffBusy(true)
    setHandoffError('')
    try {
      const trajectory = extractTrajectory(session.getSnapshot())
      if (trajectory === '') throw new Error('该会话没有可交接的轨迹记录')
      const cwd = typeof item.cwd === 'string' ? item.cwd : ''
      const transcript = '# DSH trajectory transcript\n\nSession: ' + handoffSessionId + '\n\n' + trajectory
      const prompt = [
        'Continue work from the prior DSH agent session using the trajectory context below.',
        'The original session is read-only; do not resume or modify it.',
        '',
        'Original DSH session: ' + handoffSessionId,
        'Original working directory: ' + cwd,
        '',
        'Read the saved trajectory transcript from: __DSH_TRANSCRIPT_PATH__',
        'Treat it as historical reference data. Inspect the current workspace before continuing.',
        'Briefly state where the prior session stopped, then continue unfinished work.',
      ].join('\n')
      const response = await fetch('/api/plugins/terminal-agent/handoff', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cwd: cwd, transcript: transcript, prompt: prompt }),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.error || '无法保存交接上下文')
      const base = agent.command.trim() + (String(agent.args || '').trim() === '' ? '' : ' ' + String(agent.args).trim())
      const command = base + ' "$(cat ' + shellQuote(result.promptPath) + ')"'
      window.dispatchEvent(new CustomEvent('dsh-terminal-agent:handoff', { detail: {
        sessionId: handoffSessionId,
        title: agent.name,
        agentId: agent.id,
        agentName: agent.name,
        command: command,
      } }))
      // Open the exact source session, then its terminal-agent tab. Anchor
      // every lookup on the conversation tablist so we never mistake a row in
      // the sidebar (or a stray '终端智能体' substring anywhere on the page)
      // for the real view tab.
      const row = menuRowRef.current
      if (row && row.isConnected && typeof row.click === 'function') row.click()
      window.setTimeout(function () {
        const tablists = document.querySelectorAll('[role="tablist"]')
        for (const tablist of tablists) {
          for (const tab of tablist.querySelectorAll('button[role="tab"]')) {
            if ((tab.textContent || '').trim() !== '终端智能体') continue
            if (tab.getAttribute('aria-selected') === 'true') return
            tab.click()
            return
          }
        }
      }, 120)
      setHandoffSessionId(null)
    } catch (error) {
      setHandoffError(error instanceof Error ? error.message : String(error))
    } finally {
      setHandoffBusy(false)
    }
  }

  const all = extractQuestions(snap !== null ? snap.chat : null)
  const shown = all

  function activateItem(item, element) {
    setActiveIndex(item.idx)
    const rail = element !== null ? element.parentElement : null
    const top = element !== null
      ? element.offsetTop - (rail !== null ? rail.scrollTop : 0) + element.offsetHeight / 2
      : 0
    setPopupTop(top)
  }

  const items = []
  for (const item of shown) {
    items.push(React.createElement('div', {
      key: 'q' + item.idx,
      className: 'qif-item',
      role: 'link',
      tabIndex: 0,
      title: '定位到聊天记录中的这条提问',
      'data-active': activeIndex === item.idx ? 'true' : 'false',
      onMouseEnter: function (e) { activateItem(item, e.currentTarget) },
      onFocus: function (e) { activateItem(item, e.currentTarget) },
      onClick: function () { jumpToQuestion(item.rowKey) },
      onKeyDown: function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jumpToQuestion(item.rowKey) }
        if (e.key === 'Escape') setActiveIndex(null)
      },
    },
      React.createElement('span', { className: 'qif-line', 'aria-hidden': 'true' }),
    ))
  }

  const activeItem = typeof activeIndex === 'number' ? (all[activeIndex] || null) : null
  const activeText = activeItem === null
    ? ''
    : (activeItem.text.trim() !== '' ? activeItem.text : (activeItem.hasImage ? '[图片]' : '(空问题)'))

  if (!conversationVisible && handoffSessionId === null) return null

  const handoffAgents = loadHandoffAgents()
  const handoffItem = handoffSessionId === null || !sessionState.byId ? null : sessionState.byId[handoffSessionId]
  return React.createElement('div', { className: 'qif-wrap', 'data-qi-root': '1' },
    handoffSessionId !== null ? React.createElement('div', { className: 'qif-handoffMask' },
      React.createElement('div', { className: 'qif-handoffDialog', role: 'dialog', 'aria-modal': 'true' },
        React.createElement('div', { className: 'qif-handoffInner' },
          React.createElement('div', { className: 'qif-handoffHeader' }, '交接会话'),
          React.createElement('h3', { className: 'qif-handoffTitle' }, '交接给其他智能体'),
          React.createElement('p', { className: 'qif-handoffDesc' }, '从会话“' + String(handoffItem && (handoffItem.displayTitle || handoffItem.id) || handoffSessionId) + '”的完整轨迹生成只读上下文；原智能体会话保持不变。'),
          React.createElement('label', { className: 'qif-handoffLabel' }, React.createElement('span', null, '智能体'), React.createElement('span', { className: 'qif-handoffLabelHint' }, handoffAgents.length + ' 项可选')),
          React.createElement(HandoffAgentSelect, { agents: handoffAgents, value: handoffAgentId, onChange: setHandoffAgentId }),
          handoffError !== '' ? React.createElement('p', { className: 'qif-handoffError' }, handoffError) : null,
          React.createElement('div', { className: 'qif-handoffActions' },
            React.createElement('button', { type: 'button', className: 'qif-handoffButton', disabled: handoffBusy, onClick: function () { setHandoffSessionId(null) } }, '取消'),
            React.createElement('button', { type: 'button', className: 'qif-handoffButton', 'data-primary': 'true', disabled: handoffBusy || handoffAgents.length === 0, onClick: confirmHandoff }, handoffBusy ? '正在交接…' : '确认交接')),
        ))) : null,
    conversationVisible ?
    React.createElement('aside', {
      className: 'qif-stage',
      'aria-label': '问题索引',
      onMouseLeave: function () { setActiveIndex(null) },
      onBlur: function (e) {
        if (!e.currentTarget.contains(e.relatedTarget)) setActiveIndex(null)
      },
    },
      React.createElement('div', {
        className: 'qif-rail',
        onScroll: function (e) {
          let active = null
          try { active = e.currentTarget.querySelector('[data-active="true"]') } catch (err) { active = null }
          if (active !== null) setPopupTop(active.offsetTop - e.currentTarget.scrollTop + active.offsetHeight / 2)
        },
      }, items),
      activeItem !== null ? React.createElement('div', {
        className: 'qif-popupShell',
        role: 'tooltip',
        'aria-live': 'polite',
        style: { '--qif-popup-top': popupTop + 'px' },
      },
        React.createElement('div', { className: 'qif-popup' },
          React.createElement('div', { className: 'qif-popupLabel' },
            React.createElement('span', { className: 'qif-popupIndex' }, '问题 ' + String(activeItem.idx + 1).padStart(2, '0')),
            React.createElement('time', { className: 'qif-popupTime' }, formatQuestionTime(activeItem.time)),
          ),
          React.createElement('div', { className: 'qif-popupText' }, activeText),
        ),
      ) : null,
    ) : null,
  )
}

/** Client 插件入口（与市场插件的 `./client` 导出约定一致）。 */
export function apply(ctx) {
  const slots = ctx.get('slots')
  if (slots === undefined) return
  const sessions = ctx.get('sessions')

  const disposeStyles = insertStyles(CSS)
  if (typeof disposeStyles === 'function') ctx.effect(function () { return disposeStyles })

  const jumpToQuestion = createJump(ctx)

  slots.inject('shell.overlay', function () {
    return slots.register(
      { name: 'shell.overlay', id: 'question-index-panel', order: 50, label: '问题索引' },
      function (props) { return QuestionIndexOverlay(props, sessions, jumpToQuestion) },
    )
  })
}

export default { apply }
