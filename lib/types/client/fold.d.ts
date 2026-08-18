import type { ChatMessage, WireEvent } from './types.ts';
/** Apply one DSH session event to a small, UI-oriented message projection. */
export declare function applyEvent(input: readonly ChatMessage[], event: WireEvent): ChatMessage[];
export declare function foldEvents(events: readonly WireEvent[]): ChatMessage[];
export declare function maxSeq(events: readonly WireEvent[]): number;
export declare function minSeq(events: readonly WireEvent[]): number;
