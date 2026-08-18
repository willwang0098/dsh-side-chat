import type { TabComponentProps, TabDescriptor } from 'dsh-better-sidebar';
import type { SideChatContext } from './types.ts';
declare function SideChatTab(props: TabComponentProps & {
    ctx: SideChatContext;
}): JSX.Element;
declare const descriptor: TabDescriptor;
export declare const inject: readonly ["betterSidebar", "sessions", "connection"];
export declare function apply(ctx: SideChatContext): void;
export { SideChatTab, descriptor };
