import { toT } from './dates'

export const heldAt = (x: { from?: string; to?: string }, t: number) => (!x.from || toT(x.from) <= t) && (!x.to || t <= toT(x.to, true))

// Which system a position belongs to, for the lanes of the positions band.
// Positions may set `sys` explicitly; otherwise it is guessed from the body name and the
// first item of a combined title (中共中央副主席、中央军委副主席… is read as a party post).

export const SYSTEMS = { party: '党', gov: '政', army: '军', other: '其他' } as const
export type Sys = keyof typeof SYSTEMS

type Pos = { title: string; orgName?: string; sys?: Sys }

const ARMY_FIRST = /军校|军政大学|红军大学|军团|方面军/
// mass organisations, schools, academies, rebel groups: so 井冈山兵团 is not read as army and 妇联主席 not as state
const OTHER = /妇联|妇女联合会|文联|文学艺术界|作家协会|左翼|工会|共青团|青年共产国际|红卫兵|红代会|井冈山|造反|大学|中学|学院|科学院|民主同盟|工厂|厂$|翻译|教授|新华|救亡/
const PARTY_TITLE = /党委|书记|总支|党团|工作组/
const ARMY = /[一二三四五六七八九十]军|军委|解放军|红军|八路军|新四军|野战军|军区|空军|海军|总参|总政|总后|兵团|国防部|滇军|军长|师长|旅长|司令|政治委员|参谋|全军/
const PARTY = /中共|党委|党组|总支|书记|政治局|中央委员|中央办公厅|中央文革|文化革命小组|五人小组|宣传部|组织部|红旗|人民日报|解放日报|晋察冀日报|前线|专案|工作组|顾问委员会|纪律检查|政法委/
const GOV = /国务院|政务院|总理|国务委员|部长|部$|国家|政府|人民委员会|市长|省长|主席|人大|政协|委员会|法院|检察|局长/

export function systemOf(p: Pos): Sys {
  if (p.sys) return p.sys
  const head = p.title.split('、')[0]
  const s = `${p.orgName ?? ''} ${head}`
  if (ARMY_FIRST.test(s)) return 'army'
  if (p.orgName?.startsWith('中共')) return ARMY.test(s) ? 'army' : 'party'
  if (OTHER.test(s)) return PARTY_TITLE.test(p.title) ? 'party' : 'other'
  if (ARMY.test(s)) return 'army'
  if (PARTY.test(s)) return 'party'
  if (GOV.test(s)) return 'gov'
  return 'other'
}
