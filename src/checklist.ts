import type { Rec } from './store'

export const TYPES = ['SAQ1', 'SAQ2', 'CME', 'COLOC', 'RELOC']
/** A row can hold a document, an OUT, or both (the OUT sits on the row of the document that releases it). A row with neither only keeps an empty section alive. */
export const isBlank = (r: Rec) => !r.label && !r.out
export interface Sec { name: string; rows: Rec[]; docs: number; done: number; outs: number; outed: number; ready: boolean }

export function sections(rows: Rec[]): Sec[] {
  const sorted = [...rows].sort((a, b) => Number(a.order) - Number(b.order))
  const names: string[] = []
  sorted.forEach(r => { if (!names.includes(r.section)) names.push(r.section) })
  return names.map(name => {
    const rs = sorted.filter(r => r.section === name)
    const docs = rs.filter(r => r.label), outs = rs.filter(r => r.out)
    const done = docs.filter(r => r.status === 'Done').length
    return { name, rows: rs, docs: docs.length, done, outs: outs.length, outed: outs.filter(r => r.outStatus === 'Out').length, ready: docs.length > 0 && done === docs.length }
  })
}
export function siteStats(rows: Rec[]) {
  const docs = rows.filter(r => r.label), outs = rows.filter(r => r.out)
  const done = docs.filter(r => r.status === 'Done').length
  return { items: docs.length, done, outs: outs.length, outed: outs.filter(r => r.outStatus === 'Out').length, keyPending: docs.filter(r => r.key === 'yes' && r.status !== 'Done').length, pct: docs.length ? Math.round((done / docs.length) * 100) : 0 }
}
export function typeSummary(data: Record<string, Rec[]>, type: string) {
  const sites = (data.projects ?? []).filter(p => p.type === type)
  const rows = sites.flatMap(s => (data.checklist ?? []).filter(r => r.project === s.code))
  return { type, sites: sites.length, ...siteStats(rows) }
}
