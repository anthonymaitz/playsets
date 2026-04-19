import { EmotePanel } from './EmotePanel'
import { StatusPanel } from './StatusPanel'
import { AnimationPanel } from './AnimationPanel'
import { SpeechPanel } from './SpeechPanel'
import type { AnimationName } from '../../types'

interface Props {
  instanceId: string
  activeStatuses: string[]
  activeAnimation: AnimationName
  currentSpeech: string
  isHidden: boolean
  onEmote: (instanceId: string, emote: string) => void
  onToggleStatus: (instanceId: string, statuses: string[]) => void
  onAnimate: (instanceId: string, animation: AnimationName) => void
  onSpeech: (instanceId: string, speech: string) => void
  onToggleHide: (instanceId: string, hidden: boolean) => void
}

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
}

const VDIVIDER: React.CSSProperties = {
  width: 1, background: 'rgba(255,255,255,0.1)', alignSelf: 'stretch', margin: '0 10px',
}

const SECTION: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
}

export function TokenMenu({
  instanceId,
  activeStatuses, activeAnimation, currentSpeech, isHidden,
  onEmote, onToggleStatus, onAnimate, onSpeech, onToggleHide,
}: Props) {
  return (
    <>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 61, background: 'rgba(15,15,22,0.95)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
          padding: '8px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'row', alignItems: 'flex-start',
        }}
      >
        <div style={SECTION}>
          <div style={LABEL}>View</div>
          <button
            onPointerDown={(e) => { e.stopPropagation(); onToggleHide(instanceId, !isHidden) }}
            style={{
              height: 28, padding: '0 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: isHidden ? 'rgba(255,210,50,0.2)' : 'rgba(30,30,40,0.9)',
              border: isHidden ? '1px solid rgba(255,210,50,0.7)' : '1px solid rgba(255,255,255,0.15)',
              borderRadius: 4, color: isHidden ? '#ffe033' : '#aaa', whiteSpace: 'nowrap',
            }}
          >
            {isHidden ? '👁 Show' : '🙈 Hide'}
          </button>
        </div>

        <div style={VDIVIDER} />

        <div style={SECTION}>
          <div style={LABEL}>Emote</div>
          <EmotePanel instanceId={instanceId} onEmote={onEmote} />
        </div>

        <div style={VDIVIDER} />

        <div style={SECTION}>
          <div style={LABEL}>Status</div>
          <StatusPanel instanceId={instanceId} activeStatuses={activeStatuses} onToggle={onToggleStatus} />
        </div>

        <div style={VDIVIDER} />

        <div style={SECTION}>
          <div style={LABEL}>Animation</div>
          <AnimationPanel instanceId={instanceId} activeAnimation={activeAnimation} onAnimate={onAnimate} />
        </div>

        <div style={VDIVIDER} />

        <div style={SECTION}>
          <div style={LABEL}>Speech</div>
          <SpeechPanel instanceId={instanceId} currentSpeech={currentSpeech} onSpeech={onSpeech} />
        </div>
      </div>
    </>
  )
}
