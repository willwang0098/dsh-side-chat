import { describe, expect, it } from 'vitest'
import { applyEvent, foldEvents, maxSeq, minSeq } from '../src/client/fold.ts'
import type { WireEvent } from '../src/client/types.ts'

function event(seq: number, type: string, data: unknown): WireEvent {
  return { seq, type, time: seq * 1000, data }
}

describe('side chat event fold', () => {
  it('folds user, streaming reasoning/text, tool calls and final assistant output', () => {
    const messages = foldEvents([
      event(1, 'user/message', { id: 'u1', content: [{ type: 'text', text: '请解释这段代码' }] }),
      event(2, 'turn/start', { turn: 1 }),
      event(3, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'reasoning-delta', text: '先检查上下文。' } }),
      event(4, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', text: '结论是：' } }),
      event(5, 'tool/call', { turn: 1, step: 1, callId: 'c1', name: 'read', arguments: { path: 'src/a.ts' } }),
      event(6, 'tool/result', { callId: 'c1', content: [{ type: 'text', text: 'const value = 1' }] }),
      event(7, 'assistant/message', { turn: 1, step: 1, message: { id: 'a1', content: [{ type: 'text', text: '结论是：代码可以正常运行。' }] } }),
      event(8, 'turn/end', { turn: 1 }),
    ])

    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({ kind: 'user', text: '请解释这段代码' })
    expect(messages[1]).toMatchObject({
      id: 'a1', kind: 'assistant', text: '结论是：代码可以正常运行。',
      reasoning: '先检查上下文。', pending: false,
    })
    expect(messages[1]?.tools[0]).toMatchObject({ callId: 'c1', name: 'read', result: 'const value = 1' })
  })

  it('keeps incremental chunks idempotent when the caller filters sequence numbers', () => {
    const first = applyEvent([], event(1, 'assistant/chunk', {
      turn: 1, step: 1, chunk: { type: 'text-delta', text: 'a' },
    }))
    const second = applyEvent(first, event(2, 'assistant/chunk', {
      turn: 1, step: 1, chunk: { type: 'text-delta', text: 'b' },
    }))
    expect(second[0]?.text).toBe('ab')
    expect(maxSeq([event(9, 'x', {}), event(3, 'x', {})])).toBe(9)
    expect(minSeq([event(9, 'x', {}), event(3, 'x', {})])).toBe(3)
  })

  it('does not expose inherited messages when the caller filters at baseline', () => {
    const visible = foldEvents([
      event(10, 'user/message', { id: 'u2', content: [{ type: 'text', text: '侧边问题' }] }),
      event(11, 'assistant/message', { turn: 2, step: 1, message: { id: 'a2', content: [{ type: 'text', text: '侧边回答' }] } }),
    ])
    expect(visible.map(message => message.text)).toEqual(['侧边问题', '侧边回答'])
  })
})
