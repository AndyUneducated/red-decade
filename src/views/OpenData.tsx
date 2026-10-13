import { useEffect, useState } from 'react'
import { PageTitle } from '../components/PageTitle'

// public/data/open/index.json as tools/build/open.ts writes it
type Index = {
  site: string
  repo: string
  builtAt: string
  commit?: string
  license: { data: string; texts: string }
  tables: {
    id: string
    name: string
    about: string
    rows: number
    stableIds: boolean
    parent?: string
    link?: string
    json: string
    csv: string
    bytes: { json: number; csv: number }
    cols: { key: string; about: string; csvOnly?: boolean }[]
    nested?: Record<string, string>
  }[]
}

const BASE = `${import.meta.env.BASE_URL}data/`
const DOCS = 'https://github.com/AndyUneducated/red-decade/blob/main/docs'
const size = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`)
const today = () => new Date().toISOString().slice(0, 10)

export function OpenData() {
  const [index, setIndex] = useState<Index>()
  const [ids, setIds] = useState<Set<string>>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    Promise.all([fetch(`${BASE}open/index.json`).then((r) => r.json()), fetch(`${BASE}open/ids.txt`).then((r) => r.text())])
      .then(([i, t]: [Index, string]) => {
        setIndex(i)
        setIds(new Set(t.split('\n')))
      })
      .catch(() => setFailed(true))
  }, [])

  return (
    <div className="view">
      <div className="research open-data">
        <div className="viewhead" style={{ padding: '0 0 14px', border: 0 }}>
          <div>
            <PageTitle />
            <p>
              站内全部数据都可以下载：每张表一份 JSON（完整记录，含嵌套字段）和一份 CSV（每条一行，UTF-8，Excel 可直接打开）。字段说明与下面相同，也见{' '}
              <a href={`${DOCS}/fields.md`} target="_blank" rel="noreferrer">
                docs/fields.md
              </a>
              ；格式、id 规则、引用方式与复现构建见{' '}
              <a href={`${DOCS}/data.md`} target="_blank" rel="noreferrer">
                docs/data.md
              </a>
              。
            </p>
          </div>
        </div>
        {failed && <p className="open-note">没有读到 data/open/index.json，请先运行 npm run data:build。</p>}
        {index && (
          <>
            <p className="open-note">
              数据构建于 {new Date(index.builtAt).toLocaleString('zh-CN')}
              {index.commit && (
                <>
                  ，版本{' '}
                  <a href={`${index.repo}/commit/${index.commit}`} target="_blank" rel="noreferrer">
                    <code>{index.commit.slice(0, 7)}</code>
                  </a>
                </>
              )}
              。许可：{index.license.data}；{index.license.texts}。完整构建产物 <a href={`${BASE}atlas.json`}>atlas.json</a>
              ，原文全文在 <code>data/texts/&lt;来源 id&gt;.txt</code>。
            </p>
            <Cite index={index} ids={ids} />
            <h2 className="sec" style={{ marginTop: 24 }}>
              数据表（{index.tables.length}）
            </h2>
            {index.tables.map((t) => (
              <details key={t.id} className="open-table">
                <summary>
                  <span>
                    <b>{t.name}</b> <code>{t.id}</code>
                  </span>
                  <span className="open-rows">{t.rows.toLocaleString('zh-CN')} 条</span>
                  <span className="open-about">{t.about}</span>
                  <span className="open-files">
                    <a href={BASE + t.json} download onClick={(e) => e.stopPropagation()}>
                      JSON {size(t.bytes.json)}
                    </a>
                    <a href={BASE + t.csv} download onClick={(e) => e.stopPropagation()}>
                      CSV {size(t.bytes.csv)}
                    </a>
                  </span>
                </summary>
                <p className="open-note">
                  {t.stableIds ? `id 稳定，引用写 ${t.id}/<id>` : `没有自己的 id，经 ${t.parent} 的 id 引用`}
                  {t.link && (
                    <>
                      ；站内网址 <code>{t.link}</code>
                    </>
                  )}
                </p>
                <table className="sources">
                  <tbody>
                    {t.cols.map((c) => (
                      <tr key={c.key}>
                        <td className="num">{c.key}</td>
                        <td>
                          {c.about}
                          {c.csvOnly && <span className="open-muted">（只在 CSV）</span>}
                        </td>
                      </tr>
                    ))}
                    {Object.entries(t.nested ?? {}).map(([k, v]) => (
                      <tr key={k}>
                        <td className="num">{k}</td>
                        <td>
                          {v}
                          <span className="open-muted">（只在 JSON）</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// builds the citation for one record from its table and id
function Cite({ index, ids }: { index: Index; ids?: Set<string> }) {
  const stable = index.tables.filter((t) => t.stableIds)
  const [table, setTable] = useState('people')
  const [id, setId] = useState('liu-shaoqi')
  const t = stable.find((x) => x.id === table) ?? stable[0]
  const key = id.trim()
  const found = ids?.has(`${t.id}/${key}`)
  const url = t.link ? index.site + t.link.replace('{id}', key) : index.site + 'data/' + t.json
  const text = `红色年代 · Red Decade，${t.name} ${t.id}/${key}，数据版本 ${index.commit?.slice(0, 7) ?? '未知'}，${url}，访问于 ${today()}。`
  return (
    <div className="open-cite">
      <h2 className="sec">引用一条数据</h2>
      <div className="open-cite-row">
        <select value={t.id} onChange={(e) => setTable(e.target.value)} aria-label="表">
          {stable.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}（{x.id}）
            </option>
          ))}
        </select>
        <input value={id} onChange={(e) => setId(e.target.value)} aria-label="id" spellCheck={false} />
      </div>
      {key && !found && ids && <p className="open-muted">没有这个 id。id 见各表 JSON 或 CSV 的 id 列，全部登记在 data/open/ids.txt。</p>}
      {found && <p className="open-cite-text">{text}</p>}
    </div>
  )
}
