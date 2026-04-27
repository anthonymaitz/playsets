import { createSignal, For } from 'solid-js'

const EMOTES = ['😄', '😂', '😮', '😢', '😡', '❤️', '👍', '👏']

interface Props {
  instanceId: string
  currentSpeech?: string
  onEmote: (instanceId: string, emote: string) => void
  onSpeech: (instanceId: string, speech: string) => void
  onDismiss?: () => void
}

export function TokenActionMenu(props: Props) {
  const [draft, setDraft] = createSignal(props.currentSpeech ?? '')
  return (
    <div
      style="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:80;background:rgba(10,12,16,0.96);border:1px solid rgba(255,255,255,0.14);border-radius:12px;padding:12px 14px;box-shadow:0 4px 24px rgba(0,0,0,0.7);display:flex;flex-direction:column;gap:10px;min-width:160px;pointer-events:auto;"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div style="font-size:10px;color:rgba(200,137,58,0.9);font-weight:700;font-family:monospace;">Emote</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;width:128px;">
        <For each={EMOTES}>
          {(emote) => (
            <button
              onPointerDown={(e) => { e.stopPropagation(); props.onEmote(props.instanceId, emote); props.onDismiss?.() }}
              style="width:28px;height:28px;font-size:16px;background:rgba(30,30,40,0.9);border:1px solid rgba(255,255,255,0.15);border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;"
            >
              {emote}
            </button>
          )}
        </For>
      </div>
      <div style="font-size:10px;color:rgba(200,137,58,0.9);font-weight:700;font-family:monospace;">Say</div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        <textarea
          value={draft()}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Say something…"
          rows={2}
          style="resize:none;font-size:11px;padding:4px 6px;background:rgba(20,20,28,0.95);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:4px;outline:none;width:128px;box-sizing:border-box;"
        />
        <div style="display:flex;gap:4px;">
          <button
            onPointerDown={(e) => { e.stopPropagation(); props.onSpeech(props.instanceId, draft()); props.onDismiss?.() }}
            style="flex:1;height:24px;font-size:11px;font-weight:600;cursor:pointer;background:rgba(80,180,100,0.3);border:1px solid rgba(80,180,100,0.7);border-radius:4px;color:#aef7b8;"
          >
            Say
          </button>
          <button
            onPointerDown={(e) => { e.stopPropagation(); setDraft(''); props.onSpeech(props.instanceId, ''); props.onDismiss?.() }}
            style="flex:1;height:24px;font-size:11px;font-weight:600;cursor:pointer;background:rgba(30,30,40,0.9);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#aaa;"
          >
            Clear
          </button>
        </div>
      </div>
      <button
        onPointerDown={(e) => { e.stopPropagation(); props.onDismiss?.() }}
        style="align-self:flex-end;padding:2px 8px;font-size:10px;background:transparent;border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#888;cursor:pointer;"
      >
        ✕
      </button>
    </div>
  )
}
