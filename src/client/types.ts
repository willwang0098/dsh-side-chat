import type { TabComponentProps } from 'dsh-better-sidebar'

export interface WireEvent {
  type: string
  seq: number
  time: number
  data: unknown
}

export interface HistoryEntry {
  event: WireEvent
  view?: unknown
}

export interface RpcError {
  code?: string
  message?: string
}

export type RpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: RpcError }

export interface RpcResponse<T> {
  result: RpcResult<T>
}

export interface HistoryValue {
  events: HistoryEntry[]
  hasMore: boolean
}

export interface PromptValue {
  accepted: true
  command?: { kind: 'success'; text?: string }
}

export interface SessionApi {
  create(input?: { cwd?: string; sessionId?: string }): Promise<RpcResponse<{ sessionId: string; agentPreset?: string }>>
  fork(input: { sessionId: string; atSeq?: number }): Promise<RpcResponse<{ sessionId: string }>>
  history(input: { sessionId: string; beforeSeq?: number; maxMessages?: number }): Promise<RpcResponse<HistoryValue>>
  prompt(input: { sessionId: string; mode: 'queue' | 'steer'; content: Array<{ type: 'text'; text: string }> }): Promise<RpcResponse<PromptValue>>
  cancel(input: { sessionId: string }): Promise<RpcResponse<{ accepted: true }>>
  rename(input: { sessionId: string; title: string }): Promise<RpcResponse<{ title: string; seq: number }>>
}

export interface ApiEnvelope {
  type?: string
  payload?: unknown
}

export interface ApiClient {
  sessions: SessionApi
  subscribeEnvelopes(listener: (batch: readonly ApiEnvelope[]) => void): () => void
}

export interface SessionSummary {
  id: string
  displayTitle?: string
  cwd?: string
}

export interface SessionListSnapshot {
  current?: string
  byId: Record<string, SessionSummary>
}

export interface SessionsService {
  list?: { getSnapshot(): SessionListSnapshot; subscribe?(listener: () => void): () => void }
  fork?(input: { sessionId: string; atSeq?: number }): Promise<string>
  create?(input?: { cwd?: string; sessionId?: string }): Promise<string>
  scope?(sessionId: string): unknown
}

export interface SideChatContext {
  betterSidebar?: {
    registerTab(descriptor: unknown): () => void
    updateTab?(tabId: string, patch: { meta?: unknown; title?: string }): void
  }
  connection?: { api: ApiClient }
  sessions?: SessionsService
  get?(name: string): unknown
  effect<T>(factory: () => T, label?: string): unknown
}

export type SideChatTabProps = TabComponentProps & { ctx: SideChatContext }

export interface SideChatLink {
  parentSessionId: string
  sideSessionId: string
  baselineSeq: number
  createdAt: number
}

export interface ToolInfo {
  callId: string
  name: string
  arguments?: string
  result?: string
  error?: boolean
}

export interface ChatMessage {
  id: string
  kind: 'user' | 'assistant'
  text: string
  reasoning?: string
  tools: ToolInfo[]
  seq: number
  time: number
  turn?: number
  step?: number
  pending?: boolean
  failed?: boolean
}
