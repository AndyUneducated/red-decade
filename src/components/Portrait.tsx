import type { CSSProperties } from 'react'
import type { Person } from '../data/schema'

// 3:4 head-and-shoulders crop; `focus` from content/photos.yaml moves the crop (CSS object-position).
export function Portrait({ p, width = 96, credit = false }: { p: Person; width?: number; credit?: boolean }) {
  const style = { '--pw': `${width}px` } as CSSProperties
  if (!p.photo)
    return (
      <div className="portrait text" style={style} aria-hidden>
        {p.name}
      </div>
    )
  const ph = p.photo
  const license = ph.license && /^public domain$/i.test(ph.license) ? '公有领域' : ph.license
  const date = ph.date?.replace(/-\?\?/g, '').replace(/^before (\d{4})$/i, '$1 年前')
  const caption = ['Wikimedia Commons', date, license].filter(Boolean).join(' · ')
  const author = ph.author && !/unknown/i.test(ph.author) ? `摄影：${ph.author}` : '摄影者不详'
  return (
    <figure style={{ margin: 0 }}>
      <div className="portrait" style={style}>
        <img
          src={`${import.meta.env.BASE_URL}${ph.src}`}
          alt={p.name}
          loading="lazy"
          style={ph.focus ? { objectPosition: ph.focus } : { objectPosition: '50% 20%' }}
        />
      </div>
      {credit && (
        <figcaption className="portrait-credit" style={style}>
          {ph.url ? (
            <a href={ph.url} target="_blank" rel="noreferrer" title={author}>
              {caption}
            </a>
          ) : (
            caption
          )}
        </figcaption>
      )}
    </figure>
  )
}
