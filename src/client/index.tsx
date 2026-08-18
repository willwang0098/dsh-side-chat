import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  IconCheckOutline16,
  IconCopyOutline16,
  IconEditOutline16,
  IconNewChatOutline16,
  IconRefreshOutline16,
  IconSendOutline16,
  IconStopFill16,
  IconThinkOutline16,
  MarkdownText,
  Tooltip,
  writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TabComponentProps, TabDescriptor } from 'dsh-better-sidebar'
import { applyEvent, foldEvents } from './fold.ts'
import { createSideLink, errorText, historyEvents, parseLink, readLink, removeLink, writeLink } from './runtime.ts'
import type { ApiEnvelope, ChatMessage, SideChatContext, SideChatLink, ToolInfo, WireEvent } from './types.ts'
import { installStyles } from './styles.ts'

const PLUGIN_NAME = '@dsh-external/dsh-side-chat'

interface ConversationInput {
  state: { getSnapshot(): { draft: string } }
  setDraft(text: string): void
}

interface ConversationService {
  input: { for(scope: unknown): ConversationInput }
}

function envelopePayload(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function responseError(response: { result: { ok: boolean; error?: { code?: string; message?: string } } }): never {
  const error = response.result.error
  throw new Error(`${error?.code ?? 'rpc-error'}: ${error?.message ?? 'request failed'}`)
}

function responseOk<T>(response: { result: { ok: true; value: T } | { ok: false; error?: { code?: string; message?: string } } }): T {
  if (response.result.ok) return response.result.value
  return responseError(response as { result: { ok: boolean; error?: { code?: string; message?: string } } })
}

function eventFromPayload(payload: Record<string, unknown>): { sessionId: string; event: WireEvent } | undefined {
  if (payload['type'] !== 'session/event' || typeof payload['sessionId'] !== 'string') return undefined
  const rawEvent = envelopePayload(payload['event'])
  if (rawEvent === undefined || typeof rawEvent['type'] !== 'string' || typeof rawEvent['seq'] !== 'number') return undefined
  return {
    sessionId: payload['sessionId'],
    event: {
      type: rawEvent['type'],
      seq: rawEvent['seq'],
      time: typeof rawEvent['time'] === 'number' ? rawEvent['time'] : Date.now(),
      data: rawEvent['data'],
    },
  }
}

function isRunningEvent(event: WireEvent): boolean | undefined {
  if (event.type === 'turn/start' || event.type === 'assistant/chunk' || event.type === 'tool/call') return true
  if (event.type === 'turn/end') return false
  return undefined
}

function ActionButton(props: {
  label: string
  onClick(): void
  icon: ReactNode
  disabled?: boolean
}): JSX.Element {
  return (
    <Tooltip label={props.label} side="top">
      <button
        type="button"
        className="dsh-side-chat-icon-button"
        aria-label={props.label}
        disabled={props.disabled}
        onClick={props.onClick}
      >
        {props.icon}
      </button>
    </Tooltip>
  )
}

function ToolDisclosure({ tool }: { tool: ToolInfo }): JSX.Element {
  const title = tool.error === true ? `${tool.name} · 失败` : tool.result === undefined ? tool.name : `${tool.name} · 完成`
  return (
    <details className="dsh-side-chat-tool">
      <summary>
        {title}
        {tool.error === true && <span className="dsh-side-chat-tool-status">（错误）</span>}
      </summary>
      {tool.arguments !== undefined && <pre>{tool.arguments}</pre>}
      {tool.result !== undefined && <pre>{tool.result}</pre>}
    </details>
  )
}

function MessageRow(props: {
  message: ChatMessage
  onCopy(text: string): void
  onSendToMain(text: string): void
  copied: boolean
  sent: boolean
}): JSX.Element {
  const { message } = props
  if (message.kind === 'user') {
    return <div className="dsh-side-chat-message user">{message.text}</div>
  }
  return (
    <article className={`dsh-side-chat-message assistant${message.pending ? ' pending' : ''}${message.failed ? ' failed' : ''}`}>
      {message.reasoning !== undefined && message.reasoning !== '' && (
        <details className="dsh-side-chat-disclosure">
          <summary><IconThinkOutline16 size={14} /> 思考过程</summary>
          <pre>{message.reasoning}</pre>
        </details>
      )}
      {message.text !== '' && (
        <div className="dsh-side-chat-message-text">
          <Markdown text={message.text} streaming={message.pending === true} />
        </div>
      )}
      {message.tools.length > 0 && (
        <div className="dsh-side-chat-tools">
          {message.tools.map(tool => <ToolDisclosure key={tool.callId} tool={tool} />)}
        </div>
      )}
      {message.pending === true && message.text === '' && message.reasoning === undefined && <span className="dsh-side-chat-action-label">处理中…</span>}
      <div className="dsh-side-chat-message-actions">
        <ActionButton
          label={props.copied ? '已复制' : '复制回答'}
          onClick={() => { props.onCopy(message.text) }}
          icon={props.copied ? <IconCheckOutline16 size={14} /> : <IconCopyOutline16 size={14} />}
        />
        <ActionButton
          label={props.sent ? '已放入主聊天草稿' : '放入主聊天草稿'}
          onClick={() => { props.onSendToMain(message.text) }}
          disabled={message.text.trim() === ''}
          icon={props.sent ? <IconCheckOutline16 size={14} /> : <IconEditOutline16 size={14} />}
        />
      </div>
    </article>
  )
}

const Markdown = MarkdownText as unknown as (props: { text: string; streaming?: boolean }) => JSX.Element

function SideChatTab(props: TabComponentProps & { ctx: SideChatContext }): JSX.Element {
  const { scope, tab } = props
  const ctx = props.ctx
  const api = ctx.connection?.api
  const parentSessionId = scope.sessionId
  const [link, setLink] = useState<SideChatLink | undefined>(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<'initializing' | 'ready' | 'error'>('initializing')
  const [error, setError] = useState<string | undefined>(undefined)
  const [sending, setSending] = useState(false)
  const [running, setRunning] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [copiedId, setCopiedId] = useState<string | undefined>(undefined)
  const [sentId, setSentId] = useState<string | undefined>(undefined)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const seenSeqsRef = useRef<Set<number>>(new Set())
  const historyLoadingRef = useRef(false)
  const liveBufferRef = useRef<WireEvent[]>([])
  const reloadTimerRef = useRef<number | undefined>(undefined)
  const composingRef = useRef(false)

  const updateTabMeta = useCallback((next: SideChatLink | null): void => {
    ctx.betterSidebar?.updateTab?.(tab.id, { meta: next })
  }, [ctx.betterSidebar, tab.id])

  const loadCurrentHistory = useCallback(async (target: SideChatLink): Promise<void> => {
    if (api === undefined) return
    historyLoadingRef.current = true
    liveBufferRef.current = []
    setPhase('initializing')
    try {
      const events = await historyEvents(api, target.sideSessionId, target.baselineSeq)
      const historySeqs = new Set(events.map(event => event.seq))
      const buffered = liveBufferRef.current.filter(event => event.seq > target.baselineSeq && !historySeqs.has(event.seq))
      const combined = [...events, ...buffered]
      seenSeqsRef.current = new Set(combined.map(event => event.seq))
      setMessages(foldEvents(combined))
      setError(undefined)
      setPhase('ready')
    } catch (reason) {
      setError(errorText(reason))
      setPhase('error')
    } finally {
      historyLoadingRef.current = false
      liveBufferRef.current = []
    }
  }, [api])

  useEffect(() => {
    if (api === undefined) {
      setPhase('error')
      setError('连接服务尚未就绪')
      return
    }
    let cancelled = false
    const candidate = refreshNonce === 0
      ? parseLink(tab.meta, parentSessionId) ?? readLink(parentSessionId)
      : undefined
    const setup = async (): Promise<void> => {
      setPhase('initializing')
      setError(undefined)
      try {
        let next = candidate
        if (next !== undefined) {
          try {
            await historyEvents(api, next.sideSessionId, next.baselineSeq)
          } catch {
            removeLink(parentSessionId)
            next = undefined
          }
        }
        if (next === undefined) next = await createSideLink(ctx, parentSessionId, scope.cwd)
        if (cancelled) return
        writeLink(next)
        updateTabMeta(next)
        setLink(next)
      } catch (reason) {
        if (cancelled) return
        setPhase('error')
        setError(errorText(reason))
      }
    }
    void setup()
    return () => { cancelled = true }
  }, [api, ctx, parentSessionId, refreshNonce, scope.cwd, updateTabMeta])

  useEffect(() => {
    if (api === undefined || link === undefined) return
    let cancelled = false
    const scheduleReload = (): void => {
      if (reloadTimerRef.current !== undefined) window.clearTimeout(reloadTimerRef.current)
      reloadTimerRef.current = window.setTimeout(() => {
        reloadTimerRef.current = undefined
        if (!cancelled) void loadCurrentHistory(link)
      }, 80)
    }
    const unsubscribe = api.subscribeEnvelopes((batch: readonly ApiEnvelope[]) => {
      for (const envelope of batch) {
        const payload = envelopePayload(envelope.payload)
        if (payload === undefined) continue
        const current = eventFromPayload(payload)
        if (current !== undefined && current.sessionId === link.sideSessionId) {
          const { event } = current
          if (event.seq <= link.baselineSeq || seenSeqsRef.current.has(event.seq)) continue
          if (historyLoadingRef.current) {
            liveBufferRef.current.push(event)
          } else {
            seenSeqsRef.current.add(event.seq)
            setMessages(previous => applyEvent(previous, event))
          }
          const live = isRunningEvent(event)
          if (live !== undefined) setRunning(live)
          continue
        }
        if (payload['type'] === 'session/subscribed' && payload['sessionId'] === link.sideSessionId) {
          scheduleReload()
        }
        if (payload['type'] === 'host/session-status' && payload['sessionId'] === link.sideSessionId && typeof payload['running'] === 'boolean') {
          setRunning(payload['running'])
        }
      }
    })
    void loadCurrentHistory(link)
    return () => {
      cancelled = true
      unsubscribe()
      if (reloadTimerRef.current !== undefined) window.clearTimeout(reloadTimerRef.current)
    }
  }, [api, link, loadCurrentHistory])

  useEffect(() => {
    const element = scrollRef.current
    if (element === null) return
    element.scrollTop = element.scrollHeight
  }, [messages.length, messages[messages.length - 1]?.seq, messages[messages.length - 1]?.text])

  const send = useCallback(async (): Promise<void> => {
    const text = input.trim()
    if (api === undefined || link === undefined || text === '' || sending) return
    setSending(true)
    setError(undefined)
    try {
      const response = await api.sessions.prompt({
        sessionId: link.sideSessionId,
        mode: 'queue',
        content: [{ type: 'text', text }],
      })
      responseOk(response)
      setInput('')
      setRunning(true)
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setSending(false)
    }
  }, [api, input, link, sending])

  const stop = useCallback(async (): Promise<void> => {
    if (api === undefined || link === undefined) return
    try {
      responseOk(await api.sessions.cancel({ sessionId: link.sideSessionId }))
      setRunning(false)
    } catch (reason) {
      setError(errorText(reason))
    }
  }, [api, link])

  const branch = useCallback((): void => {
    if (typeof window !== 'undefined' && !window.confirm('从主会话最新进度重新开始侧边对话？')) return
    removeLink(parentSessionId)
    updateTabMeta(null)
    setMessages([])
    setLink(undefined)
    setRefreshNonce(value => value + 1)
  }, [parentSessionId, updateTabMeta])

  const copy = useCallback(async (id: string, text: string): Promise<void> => {
    if (await writeClipboard(text)) {
      setCopiedId(id)
      window.setTimeout(() => setCopiedId(value => value === id ? undefined : value), 1400)
    }
  }, [])

  const sendToMain = useCallback((id: string, text: string): void => {
    if (text.trim() === '') return
    try {
      const sessionScope = ctx.sessions?.scope?.(parentSessionId)
      const conversation = ctx.get?.('conversation') as ConversationService | undefined
      if (sessionScope === undefined || conversation === undefined) throw new Error('主聊天输入框尚未就绪')
      const inputFace = conversation.input.for(sessionScope)
      const draft = inputFace.state.getSnapshot().draft
      inputFace.setDraft(draft.trim() === '' ? text : `${draft}\n\n${text}`)
      setSentId(id)
      window.setTimeout(() => setSentId(value => value === id ? undefined : value), 1400)
    } catch (reason) {
      setError(errorText(reason))
    }
  }, [ctx, parentSessionId])

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey || composingRef.current) return
    event.preventDefault()
    void send()
  }

  const headerTitle = phase === 'error' ? '侧边提问 · 错误' : '侧边提问'
  const canSend = phase === 'ready' && link !== undefined && input.trim() !== '' && !sending

  return (
    <div className="dsh-side-chat-root">
      <header className="dsh-side-chat-header">
        <span className="dsh-side-chat-title">{headerTitle}</span>
        <span className="dsh-side-chat-status">
          <span className={`dsh-side-chat-status-dot${running ? ' running' : ''}`} />
          {running ? '处理中' : phase === 'initializing' ? '连接中' : '独立会话'}
        </span>
        {running && (
          <ActionButton label="停止侧边会话" onClick={() => { void stop() }} icon={<IconStopFill16 size={15} />} />
        )}
        <ActionButton label="重新从主会话分支" onClick={branch} icon={<IconRefreshOutline16 size={15} />} />
      </header>
      {error !== undefined && <div className="dsh-side-chat-error" role="alert">{error}</div>}
      <div className="dsh-side-chat-scroll" ref={scrollRef}>
        {phase === 'initializing' && messages.length === 0 && <div className="dsh-side-chat-loading">加载侧边会话…</div>}
        {phase === 'ready' && messages.length === 0 && <div className="dsh-side-chat-empty">从主会话当前进度开始提问</div>}
        {messages.map(message => (
          <MessageRow
            key={`${message.id}:${String(message.seq)}`}
            message={message}
            copied={copiedId === message.id}
            sent={sentId === message.id}
            onCopy={text => { void copy(message.id, text) }}
            onSendToMain={text => { sendToMain(message.id, text) }}
          />
        ))}
      </div>
      <div className="dsh-side-chat-composer">
        <textarea
          className="dsh-side-chat-input"
          value={input}
          disabled={phase !== 'ready' || link === undefined}
          placeholder="输入侧边问题"
          aria-label="侧边问题"
          onChange={event => setInput(event.currentTarget.value)}
          onKeyDown={keyDown}
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={() => { composingRef.current = false }}
        />
        <span className="dsh-side-chat-hint">Shift+Enter 换行</span>
        <button
          type="button"
          className="dsh-side-chat-send"
          aria-label="发送侧边问题"
          title="发送侧边问题"
          disabled={!canSend}
          onClick={() => { void send() }}
        >
          <IconSendOutline16 size={16} />
        </button>
      </div>
    </div>
  )
}

const descriptor: TabDescriptor = {
  id: 'dsh-side-chat',
  title: '侧边提问',
  order: 40,
  single: true,
  icon: (size: number) => <IconNewChatOutline16 size={size} />,
  component: (props) => <SideChatTab {...props} ctx={props.ctx as unknown as SideChatContext} />,
}

export const inject = ['betterSidebar', 'sessions', 'connection'] as const

export function apply(ctx: SideChatContext): void {
  const service = ctx.betterSidebar
  if (service === undefined) return
  installStyles()
  ctx.effect(() => service.registerTab(descriptor), `${PLUGIN_NAME}: register side-chat tab`)
}

export { SideChatTab, descriptor }
