window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-side-chat",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/fold.ts
		function record(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
		}
		function stringValue(value) {
			return typeof value === "string" ? value : void 0;
		}
		function numberValue(value) {
			return typeof value === "number" && Number.isFinite(value) ? value : void 0;
		}
		function contentText(content, type = "text") {
			if (!Array.isArray(content)) return "";
			return content.map((block) => {
				const item = record(block);
				return item?.["type"] === type ? stringValue(item["text"]) ?? "" : "";
			}).join("");
		}
		function contentPreview(content) {
			if (!Array.isArray(content)) return "";
			return content.map((block) => {
				const item = record(block);
				if (item === void 0) return "";
				if (item["type"] === "text" || item["type"] === "reasoning") return stringValue(item["text"]) ?? "";
				return JSON.stringify(item);
			}).filter(Boolean).join("\n");
		}
		function argsText(value) {
			if (typeof value === "string") return value;
			if (value === void 0) return void 0;
			try {
				return JSON.stringify(value, null, 2);
			} catch {
				return String(value);
			}
		}
		function assistantIndex(messages, turn, step) {
			for (let index = messages.length - 1; index >= 0; index -= 1) {
				const message = messages[index];
				if (message?.kind !== "assistant") continue;
				if (turn !== void 0 && message.turn !== turn) continue;
				if (step !== void 0 && message.step !== step) continue;
				if (message.pending === true || turn === void 0 || step === void 0) return index;
			}
			return -1;
		}
		function updateAt(messages, index, patch) {
			const current = messages[index];
			if (current === void 0) return;
			messages[index] = {
				...current,
				...patch
			};
		}
		function toolIndex(tools, callId) {
			return tools.findIndex((tool) => tool.callId === callId);
		}
		/** Apply one DSH session event to a small, UI-oriented message projection. */
		function applyEvent(input, event) {
			const messages = input.map((message) => ({
				...message,
				tools: message.tools.map((tool) => ({ ...tool }))
			}));
			const data = record(event.data);
			if (data === void 0) return messages;
			if (event.type === "user/message" || event.type === "steering/message" || event.type === "context/message") {
				const id = stringValue(data["id"]) ?? `${event.type}:${String(event.seq)}`;
				const text = contentText(data["content"]) || stringValue(data["text"]) || contentPreview(data["content"]);
				const existing = messages.findIndex((message) => message.id === id);
				const next = {
					id,
					kind: "user",
					text,
					tools: [],
					seq: event.seq,
					time: event.time
				};
				if (existing >= 0) messages[existing] = next;
				else messages.push(next);
				return messages.sort((left, right) => left.seq - right.seq);
			}
			if (event.type === "assistant/chunk" || event.type === "message/chunk") {
				const chunk = record(data["chunk"]) ?? data;
				const chunkType = stringValue(chunk["type"]);
				const text = stringValue(chunk["text"]) ?? "";
				if (text === "" || chunkType !== void 0 && !["text-delta", "reasoning-delta"].includes(chunkType)) return messages;
				const turn = numberValue(data["turn"]);
				const step = numberValue(data["step"]);
				let index = assistantIndex(messages, turn, step);
				if (index < 0) {
					messages.push({
						id: `assistant:${String(turn ?? "x")}:${String(step ?? "x")}`,
						kind: "assistant",
						text: "",
						tools: [],
						seq: event.seq,
						time: event.time,
						...turn === void 0 ? {} : { turn },
						...step === void 0 ? {} : { step },
						pending: true
					});
					index = messages.length - 1;
				}
				const current = messages[index];
				if (current === void 0) return messages;
				const reasoning = chunkType === "reasoning-delta" || stringValue(data["kind"]) === "reasoning";
				updateAt(messages, index, {
					...reasoning ? { reasoning: `${current.reasoning ?? ""}${text}` } : { text: `${current.text}${text}` },
					seq: event.seq,
					time: event.time,
					pending: true
				});
				return messages.sort((left, right) => left.seq - right.seq);
			}
			if (event.type === "assistant/message" || event.type === "message/update") {
				const message = record(data["message"]) ?? data;
				const id = stringValue(message["id"]) ?? stringValue(data["id"]) ?? `assistant:${String(event.seq)}`;
				const turn = numberValue(data["turn"]);
				const step = numberValue(data["step"]);
				let index = messages.findIndex((item) => item.id === id);
				if (index < 0) index = assistantIndex(messages, turn, step);
				const current = index >= 0 ? messages[index] : void 0;
				const next = {
					id,
					kind: "assistant",
					text: contentText(message["content"]) || stringValue(message["text"]) || current?.text || "",
					...contentText(message["content"], "reasoning") || current?.reasoning ? { reasoning: contentText(message["content"], "reasoning") || current?.reasoning } : {},
					tools: current?.tools ?? [],
					seq: event.seq,
					time: event.time,
					...turn === void 0 ? current?.turn === void 0 ? {} : { turn: current.turn } : { turn },
					...step === void 0 ? current?.step === void 0 ? {} : { step: current.step } : { step },
					pending: false
				};
				if (index >= 0) messages[index] = next;
				else messages.push(next);
				return messages.sort((left, right) => left.seq - right.seq);
			}
			if (event.type === "tool/call") {
				const turn = numberValue(data["turn"]);
				const step = numberValue(data["step"]);
				let index = assistantIndex(messages, turn, step);
				if (index < 0) {
					messages.push({
						id: `assistant:${String(turn ?? "x")}:${String(step ?? "x")}`,
						kind: "assistant",
						text: "",
						tools: [],
						seq: event.seq,
						time: event.time,
						...turn === void 0 ? {} : { turn },
						...step === void 0 ? {} : { step },
						pending: true
					});
					index = messages.length - 1;
				}
				const current = messages[index];
				if (current === void 0) return messages;
				const callId = stringValue(data["callId"]) ?? `call:${String(event.seq)}`;
				const nextTool = {
					callId,
					name: stringValue(data["name"]) ?? "tool",
					...argsText(data["arguments"]) === void 0 ? {} : { arguments: argsText(data["arguments"]) }
				};
				const existingTool = toolIndex(current.tools, callId);
				const tools = [...current.tools];
				if (existingTool >= 0) tools[existingTool] = {
					...tools[existingTool],
					...nextTool
				};
				else tools.push(nextTool);
				updateAt(messages, index, {
					tools,
					seq: event.seq,
					time: event.time,
					pending: true
				});
				return messages.sort((left, right) => left.seq - right.seq);
			}
			if (event.type === "tool/result") {
				const callId = stringValue(data["callId"]) ?? `call:${String(event.seq)}`;
				for (let index = messages.length - 1; index >= 0; index -= 1) {
					const message = messages[index];
					if (message?.kind !== "assistant") continue;
					const tool = toolIndex(message.tools, callId);
					if (tool < 0) continue;
					const tools = [...message.tools];
					const currentTool = tools[tool];
					if (currentTool === void 0) continue;
					tools[tool] = {
						...currentTool,
						result: contentPreview(data["content"]) || stringValue(data["text"]) || "",
						...data["isError"] === true ? { error: true } : {}
					};
					updateAt(messages, index, {
						tools,
						seq: event.seq,
						time: event.time
					});
					return messages.sort((left, right) => left.seq - right.seq);
				}
				return messages;
			}
			if (event.type === "turn/end") {
				const turn = numberValue(data["turn"]);
				const failed = record(data["reason"])?.["kind"] === "error";
				for (let index = 0; index < messages.length; index += 1) {
					const message = messages[index];
					if (message?.kind === "assistant" && message.pending === true && (turn === void 0 || message.turn === turn)) updateAt(messages, index, {
						pending: false,
						...failed ? { failed: true } : {},
						seq: event.seq,
						time: event.time
					});
				}
				return messages.sort((left, right) => left.seq - right.seq);
			}
			if (event.type === "message/delete") {
				const id = stringValue(data["id"]);
				return id === void 0 ? messages : messages.filter((message) => message.id !== id);
			}
			return messages;
		}
		function foldEvents(events) {
			return [...events].sort((left, right) => left.seq - right.seq).reduce(applyEvent, []);
		}
		function maxSeq(events) {
			return events.reduce((max, event) => Math.max(max, event.seq), -1);
		}
		function minSeq(events) {
			return events.reduce((min, event) => Math.min(min, event.seq), Number.POSITIVE_INFINITY);
		}
		//#endregion
		//#region src/client/runtime.ts
		const STORAGE_PREFIX = "dsh-side-chat:v1:";
		const PAGE_SIZE = 50;
		const MAX_PAGES = 8;
		function localStorageOrUndefined() {
			try {
				return typeof localStorage === "undefined" ? void 0 : localStorage;
			} catch {
				return;
			}
		}
		function storageKey(parentSessionId) {
			return `${STORAGE_PREFIX}${parentSessionId}`;
		}
		function isRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		function asLink(value, parentSessionId) {
			if (!isRecord(value)) return void 0;
			const sideSessionId = value["sideSessionId"];
			const baselineSeq = value["baselineSeq"];
			const createdAt = value["createdAt"];
			if (typeof sideSessionId !== "string" || typeof baselineSeq !== "number" || typeof createdAt !== "number") return void 0;
			if (value["parentSessionId"] !== parentSessionId) return void 0;
			return {
				parentSessionId,
				sideSessionId,
				baselineSeq,
				createdAt
			};
		}
		function parseLink(value, parentSessionId) {
			return asLink(value, parentSessionId);
		}
		function readLink(parentSessionId, storage = localStorageOrUndefined()) {
			if (storage === void 0) return void 0;
			try {
				const raw = storage.getItem(storageKey(parentSessionId));
				return raw === null ? void 0 : asLink(JSON.parse(raw), parentSessionId);
			} catch {
				return;
			}
		}
		function writeLink(link, storage = localStorageOrUndefined()) {
			if (storage === void 0) return;
			try {
				storage.setItem(storageKey(link.parentSessionId), JSON.stringify(link));
			} catch {}
		}
		function removeLink(parentSessionId, storage = localStorageOrUndefined()) {
			if (storage === void 0) return;
			try {
				storage.removeItem(storageKey(parentSessionId));
			} catch {}
		}
		function messageOf(error) {
			if (error instanceof Error) return error.message;
			if (isRecord(error) && typeof error["message"] === "string") return error["message"];
			return String(error);
		}
		function unwrap(response) {
			if (response.result.ok) return response.result.value;
			throw new Error(`${response.result.error.code ?? "rpc-error"}: ${response.result.error.message ?? "request failed"}`);
		}
		function eventsOf(entries) {
			return entries.map((entry) => entry.event).filter((event) => typeof event.seq === "number");
		}
		async function historyEvents(api, sessionId, baselineSeq) {
			const pages = [];
			let beforeSeq;
			for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
				const value = unwrap(await api.sessions.history({
					sessionId,
					beforeSeq,
					maxMessages: PAGE_SIZE
				}));
				const events = eventsOf(value.events);
				pages.unshift(events);
				if (!value.hasMore || events.length === 0 || minSeq(events) <= baselineSeq) break;
				beforeSeq = minSeq(events);
			}
			return pages.flat().filter((event) => event.seq > baselineSeq);
		}
		async function tailEvents(api, sessionId) {
			return eventsOf(unwrap(await api.sessions.history({
				sessionId,
				maxMessages: PAGE_SIZE
			})).events);
		}
		function completedAnchor(events) {
			const anchors = events.filter((event) => event.type === "turn/end").map((event) => event.seq).filter((seq) => Number.isFinite(seq));
			return anchors.length === 0 ? void 0 : Math.max(...anchors);
		}
		async function forkOrCreate(ctx, parentSessionId, cwd) {
			const api = ctx.connection?.api;
			if (api === void 0) throw new Error("connection API is unavailable");
			try {
				const atSeq = completedAnchor(await tailEvents(api, parentSessionId));
				return unwrap(await api.sessions.fork({
					sessionId: parentSessionId,
					...atSeq === void 0 ? {} : { atSeq }
				})).sessionId;
			} catch (error) {
				console.info("[dsh-side-chat] fork unavailable, creating a fresh side session:", messageOf(error));
			}
			return unwrap(await api.sessions.create(cwd === void 0 ? void 0 : { cwd })).sessionId;
		}
		async function createSideLink(ctx, parentSessionId, cwd) {
			if (ctx.connection?.api === void 0) throw new Error("connection API is unavailable");
			const sideSessionId = await forkOrCreate(ctx, parentSessionId, cwd);
			const api = ctx.connection.api;
			try {
				unwrap(await api.sessions.rename({
					sessionId: sideSessionId,
					title: "侧边提问"
				}));
			} catch (error) {
				console.info("[dsh-side-chat] side-session rename skipped:", messageOf(error));
			}
			const link = {
				parentSessionId,
				sideSessionId,
				baselineSeq: maxSeq(await tailEvents(api, sideSessionId)),
				createdAt: Date.now()
			};
			writeLink(link);
			return link;
		}
		function errorText(error) {
			const text = messageOf(error);
			return text === "" ? "请求失败" : text;
		}
		//#endregion
		//#region src/client/styles.ts
		let installed = false;
		const css = `
.dsh-side-chat-root {
  --dsh-side-chat-gap: 10px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--dsw-alias-label-primary, #1f2329);
  background: var(--dsw-alias-bg-base, #fff);
  font-size: 13px;
}
.dsh-side-chat-header {
  align-items: center;
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  min-height: 38px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.08));
}
.dsh-side-chat-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary, #1f2329);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-side-chat-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--dsw-alias-label-tertiary, #8b929b);
  font-size: 11px;
  white-space: nowrap;
}
.dsh-side-chat-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-state-success-primary, #25a768);
}
.dsh-side-chat-status-dot.running {
  background: var(--dsw-alias-state-warn-primary, #e29a2d);
  animation: dsh-side-chat-pulse 1.2s ease-in-out infinite;
}
.dsh-side-chat-icon-button {
  align-items: center;
  justify-content: center;
  display: inline-flex;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  color: var(--dsw-alias-label-secondary, #66707c);
  background: transparent;
  cursor: pointer;
}
.dsh-side-chat-icon-button:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary, #1f2329);
  background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.06));
}
.dsh-side-chat-icon-button:disabled { opacity: .45; cursor: default; }
.dsh-side-chat-scroll {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  overflow: auto;
  padding: 14px 12px 18px;
  scrollbar-color: var(--dsw-alias-scrollbar-bg-l2, rgba(0,0,0,.2)) transparent;
}
.dsh-side-chat-empty,
.dsh-side-chat-loading,
.dsh-side-chat-error {
  margin: auto 8px;
  color: var(--dsw-alias-label-tertiary, #8b929b);
  line-height: 1.55;
  text-align: center;
}
.dsh-side-chat-error {
  margin: 8px 10px;
  padding: 8px 10px;
  border-radius: 6px;
  color: var(--dsw-alias-state-error-primary, #c84630);
  background: var(--dsw-alias-state-error-tertiary, rgba(200,70,48,.08));
  text-align: left;
  overflow-wrap: anywhere;
}
.dsh-side-chat-message {
  width: 100%;
  min-width: 0;
  line-height: 1.55;
}
.dsh-side-chat-message.user {
  align-self: flex-end;
  max-width: 90%;
  padding: 8px 10px;
  border-radius: 9px 9px 3px 9px;
  color: var(--dsw-alias-label-primary-inverted, #fff);
  background: var(--dsw-alias-brand-primary, #2f6feb);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.dsh-side-chat-message.assistant { padding: 0 2px; }
.dsh-side-chat-message-text { min-width: 0; overflow-wrap: anywhere; }
.dsh-side-chat-message.pending .dsh-side-chat-message-text { opacity: .95; }
.dsh-side-chat-message.failed .dsh-side-chat-message-text { color: var(--dsw-alias-state-error-primary, #c84630); }
.dsh-side-chat-message-actions {
  display: flex;
  gap: 2px;
  margin-top: 5px;
  opacity: 0;
  transition: opacity .15s ease;
}
.dsh-side-chat-message.assistant:hover .dsh-side-chat-message-actions,
.dsh-side-chat-message.assistant:focus-within .dsh-side-chat-message-actions { opacity: 1; }
.dsh-side-chat-action-label { font-size: 11px; color: var(--dsw-alias-label-tertiary, #8b929b); }
.dsh-side-chat-disclosure {
  margin: 0 0 7px;
  color: var(--dsw-alias-label-secondary, #66707c);
  font-size: 12px;
}
.dsh-side-chat-disclosure summary { cursor: pointer; user-select: none; }
.dsh-side-chat-disclosure pre,
.dsh-side-chat-tool pre {
  max-height: 180px;
  margin: 6px 0 0;
  padding: 7px 8px;
  overflow: auto;
  border-radius: 5px;
  color: var(--dsw-alias-label-secondary, #66707c);
  background: var(--dsw-alias-markdown-code-block, rgba(0,0,0,.05));
  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.dsh-side-chat-tools { margin: 8px 0 0; }
.dsh-side-chat-tool { margin-top: 5px; color: var(--dsw-alias-label-secondary, #66707c); font-size: 11px; }
.dsh-side-chat-tool summary { cursor: pointer; }
.dsh-side-chat-tool-status { color: var(--dsw-alias-state-error-primary, #c84630); }
.dsh-side-chat-composer {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-end;
  gap: 6px;
  padding: 9px 10px 10px;
  border-top: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.08));
  background: var(--dsw-alias-bg-layer-1, #fff);
}
.dsh-side-chat-input {
  min-height: 38px;
  max-height: 150px;
  flex: 1 1 auto;
  resize: vertical;
  padding: 9px 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.13));
  border-radius: 7px;
  outline: none;
  color: var(--dsw-alias-label-primary, #1f2329);
  background: var(--dsw-alias-bg-base, #fff);
  font: inherit;
  line-height: 1.45;
}
.dsh-side-chat-input:focus { border-color: var(--dsw-alias-brand-primary, #2f6feb); }
.dsh-side-chat-input::placeholder { color: var(--dsw-alias-label-tertiary, #8b929b); }
.dsh-side-chat-send {
  align-items: center;
  justify-content: center;
  display: inline-flex;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  color: #fff;
  background: var(--dsw-alias-brand-primary, #2f6feb);
  cursor: pointer;
}
.dsh-side-chat-send:hover:not(:disabled) { filter: brightness(1.06); }
.dsh-side-chat-send:disabled { opacity: .42; cursor: default; }
.dsh-side-chat-hint {
  flex: 0 0 auto;
  padding: 0 2px 3px;
  color: var(--dsw-alias-label-caption, #9aa1aa);
  font-size: 10px;
  writing-mode: vertical-rl;
  user-select: none;
}
@keyframes dsh-side-chat-pulse { 50% { opacity: .45; } }
`;
		function installStyles() {
			if (installed || typeof document === "undefined") return;
			installed = true;
			const style = document.createElement("style");
			style.dataset.plugin = "@dsh-external/dsh-side-chat";
			style.textContent = css;
			document.head.appendChild(style);
		}
		//#endregion
		//#region src/client/index.tsx
		const PLUGIN_NAME = "@dsh-external/dsh-side-chat";
		function envelopePayload(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
			return value;
		}
		function responseError(response) {
			const error = response.result.error;
			throw new Error(`${error?.code ?? "rpc-error"}: ${error?.message ?? "request failed"}`);
		}
		function responseOk(response) {
			if (response.result.ok) return response.result.value;
			return responseError(response);
		}
		function eventFromPayload(payload) {
			if (payload["type"] !== "session/event" || typeof payload["sessionId"] !== "string") return void 0;
			const rawEvent = envelopePayload(payload["event"]);
			if (rawEvent === void 0 || typeof rawEvent["type"] !== "string" || typeof rawEvent["seq"] !== "number") return void 0;
			return {
				sessionId: payload["sessionId"],
				event: {
					type: rawEvent["type"],
					seq: rawEvent["seq"],
					time: typeof rawEvent["time"] === "number" ? rawEvent["time"] : Date.now(),
					data: rawEvent["data"]
				}
			};
		}
		function isRunningEvent(event) {
			if (event.type === "turn/start" || event.type === "assistant/chunk" || event.type === "tool/call") return true;
			if (event.type === "turn/end") return false;
		}
		function ActionButton(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: props.label,
				side: "top",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "dsh-side-chat-icon-button",
					"aria-label": props.label,
					disabled: props.disabled,
					onClick: props.onClick,
					children: props.icon
				})
			});
		}
		function ToolDisclosure({ tool }) {
			const title = tool.error === true ? `${tool.name} · 失败` : tool.result === void 0 ? tool.name : `${tool.name} · 完成`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: "dsh-side-chat-tool",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [title, tool.error === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh-side-chat-tool-status",
						children: "（错误）"
					})] }),
					tool.arguments !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: tool.arguments }),
					tool.result !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: tool.result })
				]
			});
		}
		function MessageRow(props) {
			const { message } = props;
			if (message.kind === "user") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsh-side-chat-message user",
				children: message.text
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: `dsh-side-chat-message assistant${message.pending ? " pending" : ""}${message.failed ? " failed" : ""}`,
				children: [
					message.reasoning !== void 0 && message.reasoning !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
						className: "dsh-side-chat-disclosure",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconThinkOutline16, { size: 14 }), " 思考过程"] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: message.reasoning })]
					}),
					message.text !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-side-chat-message-text",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Markdown, {
							text: message.text,
							streaming: message.pending === true
						})
					}),
					message.tools.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-side-chat-tools",
						children: message.tools.map((tool) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToolDisclosure, { tool }, tool.callId))
					}),
					message.pending === true && message.text === "" && message.reasoning === void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh-side-chat-action-label",
						children: "处理中…"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-side-chat-message-actions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
							label: props.copied ? "已复制" : "复制回答",
							onClick: () => {
								props.onCopy(message.text);
							},
							icon: props.copied ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, { size: 14 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCopyOutline16, { size: 14 })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
							label: props.sent ? "已放入主聊天草稿" : "放入主聊天草稿",
							onClick: () => {
								props.onSendToMain(message.text);
							},
							disabled: message.text.trim() === "",
							icon: props.sent ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline16, { size: 14 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, { size: 14 })
						})]
					})
				]
			});
		}
		const Markdown = _deepseek_ai_dsh_client_ui_primitives.MarkdownText;
		function SideChatTab(props) {
			const { scope, tab } = props;
			const ctx = props.ctx;
			const api = ctx.connection?.api;
			const parentSessionId = scope.sessionId;
			const [link, setLink] = (0, react.useState)(void 0);
			const [messages, setMessages] = (0, react.useState)([]);
			const [input, setInput] = (0, react.useState)("");
			const [phase, setPhase] = (0, react.useState)("initializing");
			const [error, setError] = (0, react.useState)(void 0);
			const [sending, setSending] = (0, react.useState)(false);
			const [running, setRunning] = (0, react.useState)(false);
			const [refreshNonce, setRefreshNonce] = (0, react.useState)(0);
			const [copiedId, setCopiedId] = (0, react.useState)(void 0);
			const [sentId, setSentId] = (0, react.useState)(void 0);
			const scrollRef = (0, react.useRef)(null);
			const seenSeqsRef = (0, react.useRef)(/* @__PURE__ */ new Set());
			const historyLoadingRef = (0, react.useRef)(false);
			const liveBufferRef = (0, react.useRef)([]);
			const reloadTimerRef = (0, react.useRef)(void 0);
			const composingRef = (0, react.useRef)(false);
			const updateTabMeta = (0, react.useCallback)((next) => {
				ctx.betterSidebar?.updateTab?.(tab.id, { meta: next });
			}, [ctx.betterSidebar, tab.id]);
			const loadCurrentHistory = (0, react.useCallback)(async (target) => {
				if (api === void 0) return;
				historyLoadingRef.current = true;
				liveBufferRef.current = [];
				setPhase("initializing");
				try {
					const events = await historyEvents(api, target.sideSessionId, target.baselineSeq);
					const historySeqs = new Set(events.map((event) => event.seq));
					const buffered = liveBufferRef.current.filter((event) => event.seq > target.baselineSeq && !historySeqs.has(event.seq));
					const combined = [...events, ...buffered];
					seenSeqsRef.current = new Set(combined.map((event) => event.seq));
					setMessages(foldEvents(combined));
					setError(void 0);
					setPhase("ready");
				} catch (reason) {
					setError(errorText(reason));
					setPhase("error");
				} finally {
					historyLoadingRef.current = false;
					liveBufferRef.current = [];
				}
			}, [api]);
			(0, react.useEffect)(() => {
				if (api === void 0) {
					setPhase("error");
					setError("连接服务尚未就绪");
					return;
				}
				let cancelled = false;
				const candidate = refreshNonce === 0 ? parseLink(tab.meta, parentSessionId) ?? readLink(parentSessionId) : void 0;
				const setup = async () => {
					setPhase("initializing");
					setError(void 0);
					try {
						let next = candidate;
						if (next !== void 0) try {
							await historyEvents(api, next.sideSessionId, next.baselineSeq);
						} catch {
							removeLink(parentSessionId);
							next = void 0;
						}
						if (next === void 0) next = await createSideLink(ctx, parentSessionId, scope.cwd);
						if (cancelled) return;
						writeLink(next);
						updateTabMeta(next);
						setLink(next);
					} catch (reason) {
						if (cancelled) return;
						setPhase("error");
						setError(errorText(reason));
					}
				};
				setup();
				return () => {
					cancelled = true;
				};
			}, [
				api,
				ctx,
				parentSessionId,
				refreshNonce,
				scope.cwd,
				updateTabMeta
			]);
			(0, react.useEffect)(() => {
				if (api === void 0 || link === void 0) return;
				let cancelled = false;
				const scheduleReload = () => {
					if (reloadTimerRef.current !== void 0) window.clearTimeout(reloadTimerRef.current);
					reloadTimerRef.current = window.setTimeout(() => {
						reloadTimerRef.current = void 0;
						if (!cancelled) loadCurrentHistory(link);
					}, 80);
				};
				const unsubscribe = api.subscribeEnvelopes((batch) => {
					for (const envelope of batch) {
						const payload = envelopePayload(envelope.payload);
						if (payload === void 0) continue;
						const current = eventFromPayload(payload);
						if (current !== void 0 && current.sessionId === link.sideSessionId) {
							const { event } = current;
							if (event.seq <= link.baselineSeq || seenSeqsRef.current.has(event.seq)) continue;
							if (historyLoadingRef.current) liveBufferRef.current.push(event);
							else {
								seenSeqsRef.current.add(event.seq);
								setMessages((previous) => applyEvent(previous, event));
							}
							const live = isRunningEvent(event);
							if (live !== void 0) setRunning(live);
							continue;
						}
						if (payload["type"] === "session/subscribed" && payload["sessionId"] === link.sideSessionId) scheduleReload();
						if (payload["type"] === "host/session-status" && payload["sessionId"] === link.sideSessionId && typeof payload["running"] === "boolean") setRunning(payload["running"]);
					}
				});
				loadCurrentHistory(link);
				return () => {
					cancelled = true;
					unsubscribe();
					if (reloadTimerRef.current !== void 0) window.clearTimeout(reloadTimerRef.current);
				};
			}, [
				api,
				link,
				loadCurrentHistory
			]);
			(0, react.useEffect)(() => {
				const element = scrollRef.current;
				if (element === null) return;
				element.scrollTop = element.scrollHeight;
			}, [
				messages.length,
				messages[messages.length - 1]?.seq,
				messages[messages.length - 1]?.text
			]);
			const send = (0, react.useCallback)(async () => {
				const text = input.trim();
				if (api === void 0 || link === void 0 || text === "" || sending) return;
				setSending(true);
				setError(void 0);
				try {
					responseOk(await api.sessions.prompt({
						sessionId: link.sideSessionId,
						mode: "queue",
						content: [{
							type: "text",
							text
						}]
					}));
					setInput("");
					setRunning(true);
				} catch (reason) {
					setError(errorText(reason));
				} finally {
					setSending(false);
				}
			}, [
				api,
				input,
				link,
				sending
			]);
			const stop = (0, react.useCallback)(async () => {
				if (api === void 0 || link === void 0) return;
				try {
					responseOk(await api.sessions.cancel({ sessionId: link.sideSessionId }));
					setRunning(false);
				} catch (reason) {
					setError(errorText(reason));
				}
			}, [api, link]);
			const branch = (0, react.useCallback)(() => {
				if (typeof window !== "undefined" && !window.confirm("从主会话最新进度重新开始侧边对话？")) return;
				removeLink(parentSessionId);
				updateTabMeta(null);
				setMessages([]);
				setLink(void 0);
				setRefreshNonce((value) => value + 1);
			}, [parentSessionId, updateTabMeta]);
			const copy = (0, react.useCallback)(async (id, text) => {
				if (await (0, _deepseek_ai_dsh_client_ui_primitives.writeClipboard)(text)) {
					setCopiedId(id);
					window.setTimeout(() => setCopiedId((value) => value === id ? void 0 : value), 1400);
				}
			}, []);
			const sendToMain = (0, react.useCallback)((id, text) => {
				if (text.trim() === "") return;
				try {
					const sessionScope = ctx.sessions?.scope?.(parentSessionId);
					const conversation = ctx.get?.("conversation");
					if (sessionScope === void 0 || conversation === void 0) throw new Error("主聊天输入框尚未就绪");
					const inputFace = conversation.input.for(sessionScope);
					const draft = inputFace.state.getSnapshot().draft;
					inputFace.setDraft(draft.trim() === "" ? text : `${draft}\n\n${text}`);
					setSentId(id);
					window.setTimeout(() => setSentId((value) => value === id ? void 0 : value), 1400);
				} catch (reason) {
					setError(errorText(reason));
				}
			}, [ctx, parentSessionId]);
			const keyDown = (event) => {
				if (event.key !== "Enter" || event.shiftKey || composingRef.current) return;
				event.preventDefault();
				send();
			};
			const headerTitle = phase === "error" ? "侧边提问 · 错误" : "侧边提问";
			const canSend = phase === "ready" && link !== void 0 && input.trim() !== "" && !sending;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-side-chat-root",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: "dsh-side-chat-header",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-side-chat-title",
								children: headerTitle
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsh-side-chat-status",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: `dsh-side-chat-status-dot${running ? " running" : ""}` }), running ? "处理中" : phase === "initializing" ? "连接中" : "独立会话"]
							}),
							running && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
								label: "停止侧边会话",
								onClick: () => {
									stop();
								},
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconStopFill16, { size: 15 })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionButton, {
								label: "重新从主会话分支",
								onClick: branch,
								icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline16, { size: 15 })
							})
						]
					}),
					error !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-side-chat-error",
						role: "alert",
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-side-chat-scroll",
						ref: scrollRef,
						children: [
							phase === "initializing" && messages.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh-side-chat-loading",
								children: "加载侧边会话…"
							}),
							phase === "ready" && messages.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh-side-chat-empty",
								children: "从主会话当前进度开始提问"
							}),
							messages.map((message) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MessageRow, {
								message,
								copied: copiedId === message.id,
								sent: sentId === message.id,
								onCopy: (text) => {
									copy(message.id, text);
								},
								onSendToMain: (text) => {
									sendToMain(message.id, text);
								}
							}, `${message.id}:${String(message.seq)}`))
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-side-chat-composer",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								className: "dsh-side-chat-input",
								value: input,
								disabled: phase !== "ready" || link === void 0,
								placeholder: "输入侧边问题",
								"aria-label": "侧边问题",
								onChange: (event) => setInput(event.currentTarget.value),
								onKeyDown: keyDown,
								onCompositionStart: () => {
									composingRef.current = true;
								},
								onCompositionEnd: () => {
									composingRef.current = false;
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-side-chat-hint",
								children: "Shift+Enter 换行"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsh-side-chat-send",
								"aria-label": "发送侧边问题",
								title: "发送侧边问题",
								disabled: !canSend,
								onClick: () => {
									send();
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSendOutline16, { size: 16 })
							})
						]
					})
				]
			});
		}
		const descriptor = {
			id: "dsh-side-chat",
			title: "侧边提问",
			order: 40,
			single: true,
			icon: (size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconNewChatOutline16, { size }),
			component: (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SideChatTab, {
				...props,
				ctx: props.ctx
			})
		};
		const inject = [
			"betterSidebar",
			"sessions",
			"connection"
		];
		function apply(ctx) {
			const service = ctx.betterSidebar;
			if (service === void 0) return;
			installStyles();
			ctx.effect(() => service.registerTab(descriptor), `${PLUGIN_NAME}: register side-chat tab`);
		}
		//#endregion
		exports.SideChatTab = SideChatTab;
		exports.apply = apply;
		exports.descriptor = descriptor;
		exports.inject = inject;
		return module.exports;
	}
});
