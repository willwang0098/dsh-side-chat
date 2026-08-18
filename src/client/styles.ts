let installed = false

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
`

export function installStyles(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  const style = document.createElement('style')
  style.dataset.plugin = '@dsh-external/dsh-side-chat'
  style.textContent = css
  document.head.appendChild(style)
}
