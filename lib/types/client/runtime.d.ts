import type { ApiClient, RpcResponse, SideChatContext, SideChatLink, WireEvent } from './types.ts';
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
export declare function parseLink(value: unknown, parentSessionId: string): SideChatLink | undefined;
export declare function readLink(parentSessionId: string, storage?: StorageLike | undefined): SideChatLink | undefined;
export declare function writeLink(link: SideChatLink, storage?: StorageLike | undefined): void;
export declare function removeLink(parentSessionId: string, storage?: StorageLike | undefined): void;
export declare function historyEvents(api: ApiClient, sessionId: string, baselineSeq: number): Promise<WireEvent[]>;
export declare function createSideLink(ctx: SideChatContext, parentSessionId: string, cwd: string | undefined): Promise<SideChatLink>;
export declare function loadSideMessages(api: ApiClient, link: SideChatLink): Promise<import("./types.ts").ChatMessage[]>;
export declare function isRpcSuccess<T>(response: RpcResponse<T>): boolean;
export declare function errorText(error: unknown): string;
