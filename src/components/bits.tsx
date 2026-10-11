import { useState, type ReactNode } from 'react'
import type { Ref } from '../data/atlas'
import { label } from '../data/atlas'
import { STATUSES, VOICES, type Status, type Voice } from '../data/schema'
import { fmtDate } from '../lib/dates'
import { useApp } from '../state'

export const statusColor = (s?: Status) => (s ? `var(--s-${s})` : 'transparent')

export const RELATION_STYLE: Record<string, { color: string; dash?: string; width: number }> = {
  spouse: { color: 'var(--muted)', dash: '2 3', width: 1.5 },
  patron: { color: 'var(--s-restored)', width: 1.6 },
  protect: { color: 'var(--s-restored)', dash: '5 3', width: 1.6 },
  ally: { color: 'var(--rel-ally)', width: 1.2 },
  subordinate: { color: 'var(--rel-subordinate)', width: 1 },
  attack: { color: 'var(--rel-attack)', width: 1.6 },
  persecute: { color: 'var(--s-power)', width: 2.2 },
  link: { color: 'var(--s-purged)', dash: '1 3', width: 1.4 },
}

export function Entity({ refTo, children, dot }: { refTo: Ref; children?: ReactNode; dot?: string }) {
  const { ix, select } = useApp()
  return (
    <button className="chip" onClick={() => select(refTo)}>
      {dot && <i style={{ background: dot }} />}
      {children ?? label(ix, refTo)}
    </button>
  )
}

export function PersonChip({ id }: { id: string }) {
  const { ix } = useApp()
  const p = ix.person.get(id)
  if (!p) return null
  return <Entity refTo={{ type: 'person', id }} dot={ix.primaryFaction(p)?.color} />
}

export function Cite({ cite }: { cite?: string }) {
  const { ix, select } = useApp()
  if (!cite) return null
  const [id, loc] = cite.split('@')
  const s = ix.source.get(id)
  if (!s) return null
  const name = s.alias ?? s.title
  const short = name.length > 16 ? name.slice(0, 15) + '…' : name
  return (
    <button
      className="cite"
      title={`${s.title}（${fmtDate(s.date)}）${loc ? ` · ${loc}` : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        select({ type: 'doc', id, sub: loc })
      }}
    >
      ¶ {short}
      {loc && <span style={{ color: 'var(--muted)' }}>@{loc}</span>}
    </button>
  )
}

export const Verify = () => (
  <span className="verify" title="尚未与一手资料核对；来自通行史实，列入研究队列">
    待核
  </span>
)

export function StatusDot({ s }: { s?: Status }) {
  return <i className="status-dot" style={{ background: statusColor(s) }} title={s ? STATUSES[s] : ''} />
}

export function Voices({ voices }: { voices: { voice: Voice; text: string; cite?: string }[] }) {
  return (
    <div>
      {voices.map((v, i) => (
        <div className="voice" key={i} data-voice={v.voice}>
          <b>{VOICES[v.voice]}</b>
          <div>
            {v.text} <Cite cite={v.cite} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function StatusLegend() {
  return (
    <div className="legend">
      {(Object.keys(STATUSES) as Status[]).map((s) => (
        <span key={s}>
          <i style={{ background: statusColor(s) }} />
          {STATUSES[s]}
        </span>
      ))}
    </div>
  )
}

export type Tip = { x: number; y: number; content: ReactNode } | null

export function useTip() {
  const [tip, setTip] = useState<Tip>(null)
  const node = tip ? (
    <div className="tip" style={{ left: tip.x + 14, top: tip.y + 14 }}>
      {tip.content}
    </div>
  ) : null
  return { tip: node, setTip }
}
