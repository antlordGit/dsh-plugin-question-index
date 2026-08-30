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

function QuestionIndexOverlay(props, sessions, jumpToQuestion) {
  if (typeof props.useSessions !== 'function') return null
  const currentId = props.useSessions(function (s) { return s.current })
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

  if (!conversationVisible) return null

  return React.createElement('div', { className: 'qif-wrap', 'data-qi-root': '1' },
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
