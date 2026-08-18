import { foldEvents, maxSeq, minSeq } from './fold.ts'
import type {
  ApiClient,
  HistoryEntry,
  RpcResponse,
  SideChatContext,
  SideChatLink,
  WireEvent,
} from './types.ts'

const STORAGE_PREFIX = 'dsh-side-chat:v1:'
const PAGE_SIZE = 50
const MAX_PAGES = 8

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function localStorageOrUndefined(): StorageLike | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

function storageKey(parentSessionId: string): string {
  return `${STORAGE_PREFIX}${parentSessionId}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asLink(value: unknown, parentSessionId: string): SideChatLink | undefined {
  if (!isRecord(value)) return undefined
  const sideSessionId = value['sideSessionId']
  const baselineSeq = value['baselineSeq']
  const createdAt = value['createdAt']
  if (typeof sideSessionId !== 'string' || typeof baselineSeq !== 'number' || typeof createdAt !== 'number') return undefined
  if (value['parentSessionId'] !== parentSessionId) return undefined
  return { parentSessionId, sideSessionId, baselineSeq, createdAt }
}

export function parseLink(value: unknown, parentSessionId: string): SideChatLink | undefined {
  return asLink(value, parentSessionId)
}

export function readLink(parentSessionId: string, storage = localStorageOrUndefined()): SideChatLink | undefined {
  if (storage === undefined) return undefined
  try {
    const raw = storage.getItem(storageKey(parentSessionId))
    return raw === null ? undefined : asLink(JSON.parse(raw), parentSessionId)
  } catch {
    return undefined
  }
}

export function writeLink(link: SideChatLink, storage = localStorageOrUndefined()): void {
  if (storage === undefined) return
  try { storage.setItem(storageKey(link.parentSessionId), JSON.stringify(link)) } catch { /* private mode */ }
}

export function removeLink(parentSessionId: string, storage = localStorageOrUndefined()): void {
  if (storage === undefined) return
  try { storage.removeItem(storageKey(parentSessionId)) } catch { /* private mode */ }
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  if (isRecord(error) && typeof error['message'] === 'string') return error['message']
  return String(error)
}

function unwrap<T>(response: RpcResponse<T>): T {
  if (response.result.ok) return response.result.value
  throw new Error(`${response.result.error.code ?? 'rpc-error'}: ${response.result.error.message ?? 'request failed'}`)
}

function eventsOf(entries: readonly HistoryEntry[]): WireEvent[] {
  return entries.map(entry => entry.event).filter(event => typeof event.seq === 'number')
}

export async function historyEvents(api: ApiClient, sessionId: string, baselineSeq: number): Promise<WireEvent[]> {
  const pages: WireEvent[][] = []
  let beforeSeq: number | undefined
  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const value = unwrap(await api.sessions.history({ sessionId, beforeSeq, maxMessages: PAGE_SIZE }))
    const events = eventsOf(value.events)
    pages.unshift(events)
    if (!value.hasMore || events.length === 0 || minSeq(events) <= baselineSeq) break
    beforeSeq = minSeq(events)
  }
  return pages.flat().filter(event => event.seq > baselineSeq)
}

async function tailEvents(api: ApiClient, sessionId: string): Promise<WireEvent[]> {
  const value = unwrap(await api.sessions.history({ sessionId, maxMessages: PAGE_SIZE }))
  return eventsOf(value.events)
}

function completedAnchor(events: readonly WireEvent[]): number | undefined {
  const anchors = events
    .filter(event => event.type === 'turn/end')
    .map(event => event.seq)
    .filter(seq => Number.isFinite(seq))
  return anchors.length === 0 ? undefined : Math.max(...anchors)
}

async function forkOrCreate(ctx: SideChatContext, parentSessionId: string, cwd: string | undefined): Promise<string> {
  const api = ctx.connection?.api
  if (api === undefined) throw new Error('connection API is unavailable')
  try {
    const sourceTail = await tailEvents(api, parentSessionId)
    const atSeq = completedAnchor(sourceTail)
    const response = await api.sessions.fork({ sessionId: parentSessionId, ...(atSeq === undefined ? {} : { atSeq }) })
    return unwrap(response).sessionId
  } catch (error) {
    // A blank/running parent may not have a forkable completed turn. A fresh
    // session still gives the side composer a useful independent workspace.
    console.info('[dsh-side-chat] fork unavailable, creating a fresh side session:', messageOf(error))
  }
  return unwrap(await api.sessions.create(cwd === undefined ? undefined : { cwd })).sessionId
}

export async function createSideLink(ctx: SideChatContext, parentSessionId: string, cwd: string | undefined): Promise<SideChatLink> {
  if (ctx.connection?.api === undefined) throw new Error('connection API is unavailable')
  const sideSessionId = await forkOrCreate(ctx, parentSessionId, cwd)
  const api = ctx.connection.api
  // A title event makes the branch identifiable in the session tree. It does
  // not enter the chat projection and is therefore safe before the baseline.
  try { unwrap(await api.sessions.rename({ sessionId: sideSessionId, title: '侧边提问' })) } catch (error) {
    console.info('[dsh-side-chat] side-session rename skipped:', messageOf(error))
  }
  const baselineSeq = maxSeq(await tailEvents(api, sideSessionId))
  const link: SideChatLink = {
    parentSessionId,
    sideSessionId,
    baselineSeq,
    createdAt: Date.now(),
  }
  writeLink(link)
  return link
}

export async function loadSideMessages(api: ApiClient, link: SideChatLink) {
  return foldEvents(await historyEvents(api, link.sideSessionId, link.baselineSeq))
}

export function isRpcSuccess<T>(response: RpcResponse<T>): boolean {
  return response.result.ok
}

export function errorText(error: unknown): string {
  const text = messageOf(error)
  return text === '' ? '请求失败' : text
}
