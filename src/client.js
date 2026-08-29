/**
 * dsh-plugin-question-index — 问题索引（悬浮面板版）
 *
 * 在全局浮层（`shell.overlay`）注册一个可收起的悬浮面板：
 * - 展示当前会话的全部提问（含运行中插话发送的「插话」），面板内列表独立滚动
 * - 顶部搜索框按关键词过滤；面板头部「收起」按钮折叠成小胶囊启动按钮
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

  /* ── 面板：玻璃质感 + 顶部内高光 + 双层柔和投影 + 入场动画 ── */
  '.qif-panel{position:absolute;top:76px;right:16px;bottom:150px;width:312px;pointer-events:auto;display:flex;flex-direction:column;background:var(--dsw-alias-bg-overlay);background:color-mix(in srgb, var(--dsw-alias-bg-overlay) 92%, transparent);-webkit-backdrop-filter:blur(14px) saturate(1.15);backdrop-filter:blur(14px) saturate(1.15);border:1px solid color-mix(in srgb, var(--dsw-alias-border-l2) 85%, transparent);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.16),0 2px 8px rgba(0,0,0,.08),inset 0 1px 0 color-mix(in srgb, var(--dsw-alias-bg-base) 45%, transparent);overflow:hidden;animation:qif-in .18s cubic-bezier(.2,.8,.3,1)}',
  '@keyframes qif-in{from{opacity:0;transform:translateY(6px) scale(.985)}to{opacity:1;transform:none}}',

  /* ── 头部：品牌点 + 标题 + 计数胶囊 + 收起 ── */
  '.qif-head{display:flex;align-items:center;gap:8px;padding:12px 10px 10px 14px;flex:none}',
  '.qif-dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent)}',
  '.qif-title{flex:1;font-size:12.5px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-primary)}',
  '.qif-chip{flex:none;font-size:10px;line-height:1;font-weight:600;padding:4px 7px;border-radius:99px;background:color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);color:var(--dsw-alias-brand-primary)}',
  '.qif-btn{flex:none;width:24px;height:24px;padding:0;border-radius:8px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1;cursor:pointer;transition:background .15s ease,color .15s ease}',
  '.qif-btn:hover{background:color-mix(in srgb, var(--dsw-alias-label-secondary) 12%, transparent);color:var(--dsw-alias-label-primary)}',

  /* ── 工具行：搜索（聚焦品牌色柔光圈） ── */
  '.qif-toolbar{display:flex;align-items:center;padding:0 12px 10px;flex:none}',
  '.qif-search{flex:1;min-width:0;height:28px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb, var(--dsw-alias-bg-layer-1) 75%, transparent);color:var(--dsw-alias-label-primary);padding:0 10px;font-size:12px;outline:none;transition:border-color .15s ease,box-shadow .15s ease}',
  '.qif-search::placeholder{color:color-mix(in srgb, var(--dsw-alias-label-secondary) 70%, transparent)}',
  '.qif-search:focus{border-color:color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, var(--dsw-alias-border-l1));box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent)}',

  /* ── 列表：独立滚动 + 细滚动条 ── */
  '.qif-list{flex:1;min-height:0;overflow-y:auto;padding:2px 8px 10px;scrollbar-width:thin;scrollbar-color:color-mix(in srgb, var(--dsw-alias-border-l2) 60%, transparent) transparent}',
  '.qif-list::-webkit-scrollbar{width:9px}',
  '.qif-list::-webkit-scrollbar-thumb{background:color-mix(in srgb, var(--dsw-alias-border-l2) 55%, transparent);border-radius:5px;border:2px solid transparent;background-clip:content-box}',
  '.qif-list::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb, var(--dsw-alias-border-l2) 90%, transparent);border:2px solid transparent;background-clip:content-box}',
  '.qif-list::-webkit-scrollbar-track{background:transparent}',

  /* ── 行：悬停着色 + 右侧滑入箭头 + 按压反馈 ── */
  '.qif-item{position:relative;display:flex;align-items:center;gap:9px;width:100%;padding:8px 26px 8px 10px;margin-bottom:2px;background:none;border:none;border-radius:9px;cursor:pointer;text-align:left;font:inherit;color:inherit;transition:background .14s ease}',
  '.qif-item:hover{background:color-mix(in srgb, var(--dsw-alias-label-secondary) 9%, transparent)}',
  '.qif-item:active{background:color-mix(in srgb, var(--dsw-alias-label-secondary) 14%, transparent)}',
  '.qif-go{position:absolute;right:10px;top:50%;transform:translateY(-50%) translateX(-4px);font-size:11px;color:var(--dsw-alias-brand-primary);opacity:0;transition:opacity .15s ease,transform .15s ease}',
  '.qif-item:hover .qif-go{opacity:1;transform:translateY(-50%) translateX(0)}',
  '.qif-num{flex:none;min-width:18px;font-size:10px;font-weight:700;color:var(--dsw-alias-brand-primary);opacity:.9}',
  '.qif-preview{flex:1;min-width:0;font-size:12.5px;line-height:1.45;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.qif-badge{flex:none;font-size:9.5px;line-height:1;font-weight:500;padding:3px 6px;border-radius:5px;color:var(--dsw-alias-label-secondary);background:color-mix(in srgb, var(--dsw-alias-label-secondary) 10%, transparent)}',
  '.qif-time{flex:none;font-size:10px;color:color-mix(in srgb, var(--dsw-alias-label-secondary) 75%, transparent)}',

  /* ── 空态 ── */
  '.qif-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:30px 20px;text-align:center;color:color-mix(in srgb, var(--dsw-alias-label-secondary) 85%, transparent);font-size:12px;line-height:1.6}',
  '.qif-emptyMark{font-size:22px;line-height:1;opacity:.5}',

  /* ── 收起态：胶囊启动按钮（悬浮上移 + 品牌点） ── */
  '.qif-launcher{position:absolute;top:76px;right:16px;pointer-events:auto;display:flex;align-items:center;justify-content:center;width:34px;height:34px;padding:0;border-radius:50%;border:1px solid color-mix(in srgb, var(--dsw-alias-border-l2) 85%, transparent);background:var(--dsw-alias-bg-overlay);background:color-mix(in srgb, var(--dsw-alias-bg-overlay) 92%, transparent);-webkit-backdrop-filter:blur(14px) saturate(1.15);backdrop-filter:blur(14px) saturate(1.15);color:var(--dsw-alias-label-primary);cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.14),inset 0 1px 0 color-mix(in srgb, var(--dsw-alias-bg-base) 45%, transparent);transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease;animation:qif-in .18s cubic-bezier(.2,.8,.3,1)}',
  '.qif-launcher:hover{transform:translateY(-1px);border-color:color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, var(--dsw-alias-border-l2));box-shadow:0 10px 26px rgba(0,0,0,.18),inset 0 1px 0 color-mix(in srgb, var(--dsw-alias-bg-base) 45%, transparent)}',
  '.qif-launcherIcon{width:17px;height:17px;display:block}',
  '.qif-launcherCount{position:absolute;top:-5px;right:-5px;display:flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--dsw-alias-brand-primary);color:#fff;font-size:9px;font-weight:650;line-height:1;box-shadow:0 0 0 2px var(--dsw-alias-bg-base)}',
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

function previewOf(item) {
  const lines = item.text.split('\n')
  for (const line of lines) {
    const t = line.trim()
    if (t !== '') return t
  }
  return item.hasImage ? '[图片]' : '(空)'
}

function formatTime(ms) {
  if (typeof ms !== 'number' || ms <= 0) return ''
  const d = new Date(ms)
  const pad = function (x) { return String(x).padStart(2, '0') }
  const hm = pad(d.getHours()) + ':' + pad(d.getMinutes())
  const now = new Date()
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()) return hm
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm
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

function QuestionIndexOverlay(props, sessions, jumpToQuestion) {
  if (typeof props.useSessions !== 'function') return null
  const currentId = props.useSessions(function (s) { return s.current })
  const snapState = React.useState(null)
  const snap = snapState[0]
  const setSnap = snapState[1]
  const openState = React.useState(false)
  const open = openState[0]
  const setOpen = openState[1]
  const qState = React.useState('')
  const query = qState[0]
  const setQuery = qState[1]

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

  const all = extractQuestions(snap !== null ? snap.chat : null)
  const q = query.trim().toLowerCase()
  const shown = q === '' ? all : all.filter(function (item) { return item.text.toLowerCase().indexOf(q) !== -1 })

  const items = []
  for (const item of shown) {
    items.push(React.createElement('button', {
      key: 'q' + item.idx,
      className: 'qif-item',
      type: 'button',
      title: '定位到聊天记录中的这条提问',
      onClick: function () { jumpToQuestion(item.rowKey) },
    },
      React.createElement('span', { className: 'qif-num' }, String(item.idx + 1).padStart(2, '0')),
      React.createElement('span', { className: 'qif-preview' }, previewOf(item)),
      item.kind === 'steering' ? React.createElement('span', { className: 'qif-badge' }, '插话') : null,
      item.toolCalls > 0 ? React.createElement('span', { className: 'qif-badge' }, item.toolCalls + ' 工具') : null,
      React.createElement('span', { className: 'qif-time' }, formatTime(item.time)),
      React.createElement('span', { className: 'qif-go' }, '›'),
    ))
  }

  function emptyState(mark, text) {
    return React.createElement('div', { className: 'qif-empty' },
      React.createElement('div', { className: 'qif-emptyMark' }, mark),
      React.createElement('div', null, text),
    )
  }

  // 收起态：右上方小胶囊启动按钮（品牌点 + 实时计数）。
  if (!open) {
    return React.createElement('div', { className: 'qif-wrap', 'data-qi-root': '1' },
      React.createElement('button', {
        className: 'qif-launcher',
        type: 'button',
        title: '展开问题索引',
        onClick: function () { setOpen(true) },
      },
        React.createElement(
          'svg',
          { className: 'qif-launcherIcon', viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': 'true' },
          React.createElement('path', {
            d: 'M6.5 5h9M6.5 10h9M6.5 15h9M3.5 5h.01M3.5 10h.01M3.5 15h.01',
            stroke: 'currentColor',
            'stroke-width': '1.6',
            'stroke-linecap': 'round',
          }),
        ),
        all.length > 0 ? React.createElement('span', { className: 'qif-launcherCount' }, String(all.length)) : null,
      ),
    )
  }

  // 展开态：右侧悬浮面板。根节点 pointer-events:none（浮层托管规则），
  // 仅面板本身可交互，不挡下方应用操作。
  return React.createElement('div', { className: 'qif-wrap', 'data-qi-root': '1' },
    React.createElement('div', {
      className: 'qif-panel',
      onMouseLeave: function () { setOpen(false) },
    },
      React.createElement('div', { className: 'qif-head' },
        React.createElement('span', { className: 'qif-dot' }),
        React.createElement('span', { className: 'qif-title' }, '问题索引'),
        all.length > 0 ? React.createElement('span', { className: 'qif-chip' }, String(all.length)) : null,
        React.createElement('button', {
          className: 'qif-btn',
          type: 'button',
          title: '收起面板',
          'aria-label': '收起面板',
          onClick: function () { setOpen(false) },
        }, '‹'),
      ),
      React.createElement('div', { className: 'qif-toolbar' },
        React.createElement('input', {
          className: 'qif-search',
          value: query,
          placeholder: '搜索问题…',
          onChange: function (e) { setQuery(e.target.value) },
        }),
      ),
      typeof currentId !== 'string' || currentId === ''
        ? emptyState('◎', '当前没有会话')
        : (all.length === 0
          ? emptyState('❝', '这个会话还没有提问')
          : (shown.length === 0
            ? emptyState('⌕', '没有匹配的问题')
            : React.createElement('div', { className: 'qif-list' }, items))),
    ),
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
