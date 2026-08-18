# dsh-side-chat

> DSH plugin for an independent Codex-style side chat in Better Sidebar.

Keywords: `dsh-plugin` `deepseek-harness` `better-sidebar` `side-chat`

`dsh-side-chat` 为 DSH Better Sidebar 增加一个类似 Codex 侧边提问的独立对话面板。

## 功能

- 从当前主会话最近的已完成回合 fork 一个独立 side session
- 继承上下文，但隐藏 fork 前的历史，只展示侧聊新增消息
- 通过当前 API 连接读取历史和流式 session/event
- 支持 reasoning、工具调用、Markdown、停止和重新分支
- 复制回答，或把回答放入主聊天输入框草稿
- 侧边会话 ID 按主会话持久化到 Sidebar tab meta 和 localStorage

## 构建

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

安装到当前 web profile 后需要重启 DSH Web 服务，让 Cordis patch 重新加载插件。
