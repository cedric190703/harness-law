import type { Deliverable, DeliverableSection, LedgerRow, TraceNode } from './types';
import { findUseCase, type TableShape, type UseCase } from './usecases';

export function ancestors(nodes: TraceNode[], selected: string): Set<string> {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const result = new Set<string>();
  const visit = (id: string) => { if (result.has(id) || !byId.has(id)) return; result.add(id); byId.get(id)!.parents.forEach(visit); };
  visit(selected); return result;
}

export function visibleTraceNodes(nodes: TraceNode[], focus?: string, tools=false, common=false): TraceNode[] {
  const relevant=focus?ancestors(nodes,focus):null;
  const sectionFocus=nodes.some(n=>n.id===focus&&n.kind==='section');
  return nodes.filter(n=>(!relevant||relevant.has(n.id))
    &&(tools||n.kind!=='tool'||n.id===focus)
    &&(!sectionFocus||common||!['skill','input'].includes(n.kind)));
}

const KINDS = ['report','contract','disclosure-schedule','seller-questions','contract-table','counterparty-letters','cap-table'];

/** Map each required concept to a column index, so one header never satisfies two concepts. */
function matchShape(shape: TableShape, headers: string[]): Map<string,number> | null {
  const found = new Map<string,number>(), taken = new Set<number>();
  for (const column of shape.columns) {
    const index = headers.findIndex((h,i) => !taken.has(i) && column.match.test(h));
    if (index >= 0) { found.set(column.concept, index); taken.add(index); }
  }
  const missing = (shape.required ?? shape.columns.map(c => c.concept)).filter(c => !found.has(c));
  return missing.length ? null : found;
}

/** Check the use case's table shapes, and the letter/schedule parity, against the draft. */
function checkShapes(useCase: UseCase, sections: DeliverableSection[], known: Set<string>): string[] {
  const problems: string[] = [];
  const tables = sections.filter(s => s.table?.headers.length);
  for (const shape of useCase.shapes) {
    const hit = tables
      .map(section => ({ section, columns: matchShape(shape, section.table!.headers) }))
      .find((candidate): candidate is { section: DeliverableSection; columns: Map<string,number> } => !!candidate.columns);
    if (!hit) {
      const wanted = shape.columns.filter(c => (shape.required ?? shape.columns.map(x => x.concept)).includes(c.concept)).map(c => c.hint);
      problems.push(`${useCase.title} needs a section whose table is the ${shape.name}. Use these headers exactly: ${wanted.join(' | ')}.`);
      continue;
    }
    const { section, columns } = hit;
    const cell = (row: string[], concept: string) => (row[columns.get(concept)!] ?? '').trim();
    for (const concept of shape.required ?? []) {
      const hint = shape.columns.find(c => c.concept === concept)!.hint;
      const blank = section.table!.rows.map((row,i) => cell(row,concept) ? 0 : i+1).filter(Boolean);
      if (blank.length) problems.push(`${section.id}: column "${hint}" is empty on row(s) ${blank.join(', ')}. Every row of the ${shape.name} must carry it — that reference is the point of this deliverable.`);
    }
    for (const concept of shape.ledgerRefs ?? []) {
      const hint = shape.columns.find(c => c.concept === concept)!.hint;
      for (const [i,row] of section.table!.rows.entries()) {
        const cited = cell(row,concept).match(/[A-Za-z]+-\d+/g) ?? [];
        const unknown = cited.filter(id => !known.has(id));
        if (!cited.length) problems.push(`${section.id} row ${i+1}: column "${hint}" must name the ledger id behind the item (e.g. R-014).`);
        else if (unknown.length) problems.push(`${section.id} row ${i+1}: column "${hint}" cites ${unknown.join(', ')}, which is not in the ledger.`);
      }
    }
    if (useCase.letterSections) {
      const letters = sections.filter(s => /^letter-\d+$/.test(s.id)).length;
      const scheduled = section.table!.rows.length;
      if (!letters) problems.push('The letters must be written out: one section per letter, with ids letter-1, letter-2, … in the schedule order.');
      else if (letters !== scheduled) problems.push(`The schedule lists ${scheduled} letter(s) but the draft carries ${letters} letter section(s). Produce exactly one letter-N section per schedule row.`);
    }
  }
  return problems;
}

export function validateDeliverable(value: unknown, ledger: LedgerRow[], useCaseId?: string): Deliverable {
  if (!value || typeof value !== 'object') throw new Error('The deliverable must be a JSON object.');
  const draft = value as Deliverable;
  if (!draft.title?.trim() || !KINDS.includes(draft.kind) || !Array.isArray(draft.sections) || !draft.sections.length) throw new Error(`The deliverable needs a title, sections, and a kind among ${KINDS.join(', ')}.`);
  const useCase = findUseCase(useCaseId);
  if (useCase && draft.kind !== useCase.kind) throw new Error(`This mission is a ${useCase.title.toLowerCase()}: draft.json must declare "kind":"${useCase.kind}", not "${draft.kind}".`);
  const known = new Set(ledger.map(r => r.id)), seen = new Set<string>(), covered = new Set<string>();
  for (const s of draft.sections) {
    if (typeof s.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(s.id) || seen.has(s.id) || typeof s.title !== 'string' || !s.title.trim() || typeof s.content !== 'string' || !s.content.trim()) throw new Error('A section is incomplete, or an id is used twice.');
    seen.add(s.id);
    if (!Array.isArray(s.ledgerIds) || !s.ledgerIds.length || s.ledgerIds.some(id => !known.has(id))) throw new Error(`${s.id}: every section must cite ledger rows that exist.`);
    s.ledgerIds.forEach(id => covered.add(id));
    if (s.table && (!Array.isArray(s.table.headers) || !s.table.headers.length || !s.table.headers.every(x=>typeof x==='string') || !Array.isArray(s.table.rows) || s.table.rows.some(r=>!Array.isArray(r)||r.length!==s.table!.headers.length||r.some(c=>typeof c!=='string')))) throw new Error(`${s.id}: the table is malformed — every row must have one cell per header.`);
  }
  const missing = ledger.filter(r => ['deviation','missing','added','unclear'].includes(r.status) || r.status==='claim' && r.verdict==='inaccurate').filter(r=>!covered.has(r.id));
  if (missing.length) throw new Error(`Findings absent from the deliverable: ${missing.map(r=>r.id).join(', ')}`);
  if (useCase) {
    const problems = checkShapes(useCase, draft.sections, known);
    if (problems.length) throw new Error(problems.join('\n'));
  }
  return draft;
}

export function parseLedger(text: string): LedgerRow[] {
  const rows = text.split('\n').filter(l=>l.trim()).map(l=>JSON.parse(l) as LedgerRow);
  if (!rows.length || rows.some(r=>typeof r.id!=='string'||!r.id||typeof r.topic!=='string'||!r.topic) || new Set(rows.map(r=>r.id)).size!==rows.length) throw new Error('The ledger is empty, malformed, or repeats an id.');
  return rows;
}

export function safeId(id: string) { if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid identifier'); return id; }
export function safeName(name: string) { return name.replaceAll('\\','/').split('/').pop()!.replace(/[^\p{L}\p{N} ._-]/gu, '_').slice(-160) || 'document.txt'; }
