import { describe, expect, it } from 'vitest'
import { createSideLink, parseLink, readLink, removeLink, writeLink } from '../src/client/runtime.ts'
import type { StorageLike } from '../src/client/runtime.ts'
import type { SideChatContext, WireEvent } from '../src/client/types.ts'

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  removeItem(key: string): void { this.values.delete(key) }
}

describe('side chat link persistence', () => {
  it('round-trips a link and rejects a link belonging to another parent', () => {
    const storage = new MemoryStorage()
    const link = { parentSessionId: 'parent-a', sideSessionId: 'side-a', baselineSeq: 42, createdAt: 100 }
    writeLink(link, storage)
    expect(readLink('parent-a', storage)).toEqual(link)
    expect(readLink('parent-b', storage)).toBeUndefined()
    expect(parseLink({ ...link, parentSessionId: 'parent-b' }, 'parent-a')).toBeUndefined()
  })

  it('removes a stale mapping', () => {
    const storage = new MemoryStorage()
    writeLink({ parentSessionId: 'parent-a', sideSessionId: 'side-a', baselineSeq: 0, createdAt: 100 }, storage)
    removeLink('parent-a', storage)
    expect(readLink('parent-a', storage)).toBeUndefined()
  })

  it('creates a branch through the native API and records the post-title baseline', async () => {
    const calls: string[] = []
    const event = (seq: number, type: string): WireEvent => ({ seq, type, time: seq, data: type === 'turn/end' ? { turn: 1 } : {} })
    const api = {
      sessions: {
        history: async ({ sessionId }: { sessionId: string }) => {
          calls.push(`history:${sessionId}`)
          return { result: { ok: true as const, value: { events: [{ event: event(sessionId === 'parent' ? 4 : 5, sessionId === 'parent' ? 'turn/end' : 'session/title') }], hasMore: false } } }
        },
        fork: async ({ sessionId, atSeq }: { sessionId: string; atSeq?: number }) => {
          calls.push(`fork:${sessionId}:${atSeq}`)
          return { result: { ok: true as const, value: { sessionId: 'side' } } }
        },
        rename: async ({ sessionId, title }: { sessionId: string; title: string }) => {
          calls.push(`rename:${sessionId}:${title}`)
          return { result: { ok: true as const, value: { title, seq: 5 } } }
        },
      },
    }
    const ctx = { connection: { api } } as unknown as SideChatContext

    await expect(createSideLink(ctx, 'parent', '/tmp')).resolves.toMatchObject({
      parentSessionId: 'parent', sideSessionId: 'side', baselineSeq: 5,
    })
    expect(calls).toEqual(['history:parent', 'fork:parent:4', 'rename:side:侧边提问', 'history:side'])
  })
})
