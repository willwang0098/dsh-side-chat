import type { ChatMessage, ToolInfo, WireEvent } from './types.ts'

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function contentText(content: unknown, type = 'text'): string {
  if (!Array.isArray(content)) return ''
  return content
    .map(block => {
      const item = record(block)
      return item?.['type'] === type ? stringValue(item['text']) ?? '' : ''
    })
    .join('')
}

function contentPreview(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content.map(block => {
    const item = record(block)
    if (item === undefined) return ''
    if (item['type'] === 'text' || item['type'] === 'reasoning') return stringValue(item['text']) ?? ''
    return JSON.stringify(item)
  }).filter(Boolean).join('\n')
}

function argsText(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (value === undefined) return undefined
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

function assistantIndex(messages: readonly ChatMessage[], turn: number | undefined, step: number | undefined): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.kind !== 'assistant') continue
    if (turn !== undefined && message.turn !== turn) continue
    if (step !== undefined && message.step !== step) continue
    if (message.pending === true || turn === undefined || step === undefined) return index
  }
  return -1
}

function updateAt(messages: ChatMessage[], index: number, patch: Partial<ChatMessage>): void {
  const current = messages[index]
  if (current === undefined) return
  messages[index] = { ...current, ...patch }
}

function toolIndex(tools: readonly ToolInfo[], callId: string): number {
  return tools.findIndex(tool => tool.callId === callId)
}

/** Apply one DSH session event to a small, UI-oriented message projection. */
export function applyEvent(input: readonly ChatMessage[], event: WireEvent): ChatMessage[] {
  const messages = input.map(message => ({ ...message, tools: message.tools.map(tool => ({ ...tool })) }))
  const data = record(event.data)
  if (data === undefined) return messages

  if (event.type === 'user/message' || event.type === 'steering/message' || event.type === 'context/message') {
    const id = stringValue(data['id']) ?? `${event.type}:${String(event.seq)}`
    const text = contentText(data['content']) || stringValue(data['text']) || contentPreview(data['content'])
    const existing = messages.findIndex(message => message.id === id)
    const next: ChatMessage = { id, kind: 'user', text, tools: [], seq: event.seq, time: event.time }
    if (existing >= 0) messages[existing] = next
    else messages.push(next)
    return messages.sort((left, right) => left.seq - right.seq)
  }

  if (event.type === 'assistant/chunk' || event.type === 'message/chunk') {
    const chunk = record(data['chunk']) ?? data
    const chunkType = stringValue(chunk['type'])
    const text = stringValue(chunk['text']) ?? ''
    if (text === '' || (chunkType !== undefined && !['text-delta', 'reasoning-delta'].includes(chunkType))) return messages
    const turn = numberValue(data['turn'])
    const step = numberValue(data['step'])
    let index = assistantIndex(messages, turn, step)
    if (index < 0) {
      messages.push({
        id: `assistant:${String(turn ?? 'x')}:${String(step ?? 'x')}`,
        kind: 'assistant', text: '', tools: [], seq: event.seq, time: event.time,
        ...(turn === undefined ? {} : { turn }), ...(step === undefined ? {} : { step }), pending: true,
      })
      index = messages.length - 1
    }
    const current = messages[index]
    if (current === undefined) return messages
    const reasoning = chunkType === 'reasoning-delta' || stringValue(data['kind']) === 'reasoning'
    updateAt(messages, index, {
      ...(reasoning ? { reasoning: `${current.reasoning ?? ''}${text}` } : { text: `${current.text}${text}` }),
      seq: event.seq,
      time: event.time,
      pending: true,
    })
    return messages.sort((left, right) => left.seq - right.seq)
  }

  if (event.type === 'assistant/message' || event.type === 'message/update') {
    const message = record(data['message']) ?? data
    const id = stringValue(message['id']) ?? stringValue(data['id']) ?? `assistant:${String(event.seq)}`
    const turn = numberValue(data['turn'])
    const step = numberValue(data['step'])
    let index = messages.findIndex(item => item.id === id)
    if (index < 0) index = assistantIndex(messages, turn, step)
    const current = index >= 0 ? messages[index] : undefined
    const next: ChatMessage = {
      id,
      kind: 'assistant',
      text: contentText(message['content']) || stringValue(message['text']) || current?.text || '',
      ...(contentText(message['content'], 'reasoning') || current?.reasoning
        ? { reasoning: contentText(message['content'], 'reasoning') || current?.reasoning }
        : {}),
      tools: current?.tools ?? [],
      seq: event.seq,
      time: event.time,
      ...(turn === undefined ? current?.turn === undefined ? {} : { turn: current.turn } : { turn }),
      ...(step === undefined ? current?.step === undefined ? {} : { step: current.step } : { step }),
      pending: false,
    }
    if (index >= 0) messages[index] = next
    else messages.push(next)
    return messages.sort((left, right) => left.seq - right.seq)
  }

  if (event.type === 'tool/call') {
    const turn = numberValue(data['turn'])
    const step = numberValue(data['step'])
    let index = assistantIndex(messages, turn, step)
    if (index < 0) {
      messages.push({
        id: `assistant:${String(turn ?? 'x')}:${String(step ?? 'x')}`,
        kind: 'assistant', text: '', tools: [], seq: event.seq, time: event.time,
        ...(turn === undefined ? {} : { turn }), ...(step === undefined ? {} : { step }), pending: true,
      })
      index = messages.length - 1
    }
    const current = messages[index]
    if (current === undefined) return messages
    const callId = stringValue(data['callId']) ?? `call:${String(event.seq)}`
    const nextTool: ToolInfo = {
      callId,
      name: stringValue(data['name']) ?? 'tool',
      ...(argsText(data['arguments']) === undefined ? {} : { arguments: argsText(data['arguments']) }),
    }
    const existingTool = toolIndex(current.tools, callId)
    const tools = [...current.tools]
    if (existingTool >= 0) tools[existingTool] = { ...tools[existingTool], ...nextTool }
    else tools.push(nextTool)
    updateAt(messages, index, { tools, seq: event.seq, time: event.time, pending: true })
    return messages.sort((left, right) => left.seq - right.seq)
  }

  if (event.type === 'tool/result') {
    const callId = stringValue(data['callId']) ?? `call:${String(event.seq)}`
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]
      if (message?.kind !== 'assistant') continue
      const tool = toolIndex(message.tools, callId)
      if (tool < 0) continue
      const tools = [...message.tools]
      const currentTool = tools[tool]
      if (currentTool === undefined) continue
      tools[tool] = {
        ...currentTool,
        result: contentPreview(data['content']) || stringValue(data['text']) || '',
        ...(data['isError'] === true ? { error: true } : {}),
      }
      updateAt(messages, index, { tools, seq: event.seq, time: event.time })
      return messages.sort((left, right) => left.seq - right.seq)
    }
    return messages
  }

  if (event.type === 'turn/end') {
    const turn = numberValue(data['turn'])
    const reason = record(data['reason'])
    const failed = reason?.['kind'] === 'error'
    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index]
      if (message?.kind === 'assistant' && message.pending === true && (turn === undefined || message.turn === turn)) {
        updateAt(messages, index, { pending: false, ...(failed ? { failed: true } : {}), seq: event.seq, time: event.time })
      }
    }
    return messages.sort((left, right) => left.seq - right.seq)
  }

  if (event.type === 'message/delete') {
    const id = stringValue(data['id'])
    return id === undefined ? messages : messages.filter(message => message.id !== id)
  }

  return messages
}

export function foldEvents(events: readonly WireEvent[]): ChatMessage[] {
  return [...events].sort((left, right) => left.seq - right.seq).reduce(applyEvent, [])
}

export function maxSeq(events: readonly WireEvent[]): number {
  return events.reduce((max, event) => Math.max(max, event.seq), -1)
}

export function minSeq(events: readonly WireEvent[]): number {
  return events.reduce((min, event) => Math.min(min, event.seq), Number.POSITIVE_INFINITY)
}
