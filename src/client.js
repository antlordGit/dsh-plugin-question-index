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
 * 平台：Client（web）。样式走主题令牌（--dsw-alias-*），明暗主题自动适配。
 */

import React from 'react'

const CSS = [
  '.qif-wrap{position:absolute;inset:0;pointer-events:none}',
  '.qif-panel{position:absolute;top:76px;right:16px;bottom:150px;width:304px;pointer-events:auto;display:flex;flex-direction:column;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;box-shadow:0 10px 32px rgba(0,0,0,.16);overflow:hidden}',
  '.qif-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}',
  '.qif-title{flex:1;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}',
  '.qif-btn{flex:none;height:24px;border-radius:7px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:11px;cursor:pointer;padding:0 8px}',
  '.qif-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}',
  '.qif-toolbar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}',
  '.qif-count{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
  '.qif-search{flex:1;min-width:0;height:26px;border-radius:7px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 8px;font-size:12px;outline:none}',
  '.qif-search:focus{border-color:var(--dsw-alias-brand-primary)}',
  '.qif-list{flex:1;min-height:0;overflow-y:auto;padding:6px}',
  '.qif-item{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;margin-bottom:2px;background:none;border:none;border-radius:8px;cursor:pointer;text-align:left;font:inherit;color:inherit}',
  '.qif-item:hover{background:var(--dsw-alias-bg-layer-2)}',
  '.qif-num{flex:none;min-width:20px;font-size:10px;font-weight:600;color:var(--dsw-alias-brand-primary);font-variant-numeric:tabular-nums}',
  '.qif-preview{flex:1;min-width:0;font-size:12px;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.qif-badge{flex:none;font-size:10px;border-radius:5px;padding:1px 5px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}',
  '.qif-time{flex:none;font-size:10px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
  '.qif-empty{padding:26px 14px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12px}',
  '.qif-launcher{position:absolute;top:76px;right:16px;pointer-events:auto;display:flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:15px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.12)}',
  '.qif-launcher:hover{border-color:var(--dsw-alias-brand-primary)}',
  '.qif-launcherCount{font-size:10px;color:var(--dsw-alias-label-secondary)}',
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
  const openState = React.useState(true)
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
    ))
  }

  // 收起态：右上方小胶囊启动按钮（带实时计数）。
  if (!open) {
    return React.createElement('div', { className: 'qif-wrap', 'data-qi-root': '1' },
      React.createElement('button', {
        className: 'qif-launcher',
        type: 'button',
        title: '展开问题索引',
        onClick: function () { setOpen(true) },
      },
        '问题索引',
        all.length > 0 ? React.createElement('span', { className: 'qif-launcherCount' }, String(all.length)) : null,
      ),
    )
  }

  // 展开态：右侧悬浮面板。根节点 pointer-events:none（浮层托管规则），
  // 仅面板本身可交互，不挡下方应用操作。
  return React.createElement('div', { className: 'qif-wrap', 'data-qi-root': '1' },
    React.createElement('div', { className: 'qif-panel' },
      React.createElement('div', { className: 'qif-head' },
        React.createElement('span', { className: 'qif-title' }, '问题索引'),
        React.createElement('button', {
          className: 'qif-btn',
          type: 'button',
          title: '收起面板',
          onClick: function () { setOpen(false) },
        }, '收起'),
      ),
      React.createElement('div', { className: 'qif-toolbar' },
        React.createElement('span', { className: 'qif-count' }, all.length + ' 问'),
        React.createElement('input', {
          className: 'qif-search',
          value: query,
          placeholder: '搜索问题…',
          onChange: function (e) { setQuery(e.target.value) },
        }),
      ),
      typeof currentId !== 'string' || currentId === ''
        ? React.createElement('div', { className: 'qif-empty' }, '当前没有会话')
        : (all.length === 0
          ? React.createElement('div', { className: 'qif-empty' }, '这个会话还没有提问')
          : (shown.length === 0
            ? React.createElement('div', { className: 'qif-empty' }, '没有匹配的问题')
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
