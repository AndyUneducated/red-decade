import { useEffect, useState } from 'react'
import { fmtT } from '../lib/dates'
import { useApp } from '../state'

const MARKS: [number, string][] = [
  [1966 + 4.5 / 12, '五一六'],
  [1966 + 7.25 / 12, '十六条'],
  [1967 + 0.2 / 12, '一月夺权'],
  [1968 + 9.5 / 12, '八届十二中'],
  [1969 + 3 / 12, '九大'],
  [1971 + 8.4 / 12, '九一三'],
  [1976 + 9.2 / 12, '粉碎四人帮'],
  [1978 + 11.6 / 12, '三中全会'],
]

// for spans of several decades, where the 1966–1978 marks would overlap
export const LONG_MARKS: [number, string][] = [
  [1921 + 6.7 / 12, '中共一大'],
  [1937 + 6.2 / 12, '全面抗战'],
  [1949 + 9 / 12, '建国'],
  [1966 + 4.5 / 12, '五一六'],
  [1976 + 9.2 / 12, '粉碎四人帮'],
]

export function Scrubber({ min = 1965, max = 1981, marks = MARKS }: { min?: number; max?: number; marks?: [number, string][] }) {
  const { t, setT } = useApp()
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setT(t + 1 / 24 >= max ? min : t + 1 / 24)
    }, 220)
    return () => clearInterval(id)
  }, [playing, t, setT, min, max])

  const pct = (v: number) => `${((v - min) / (max - min)) * 100}%`

  return (
    <div className="scrubber">
      <button className="play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? '暂停' : '播放'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <output>{fmtT(t)}</output>
      <div style={{ flex: 1, position: 'relative', paddingBottom: 14 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={1 / 365}
          value={Math.min(max, Math.max(min, t))}
          onChange={(e) => setT(Number(e.target.value))}
          style={{ width: '100%' }}
          aria-label="时间"
        />
        <div className="marks">
          {marks.filter(([m]) => m >= min && m <= max).map(([m, l]) => (
            <button
              key={l}
              onClick={() => setT(m)}
              style={{ position: 'absolute', left: pct(m), bottom: 0, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
