import type { Deliverable, LedgerRow, TraceNode } from './types';

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

export function validateDeliverable(value: unknown, ledger: LedgerRow[]): Deliverable {
  if (!value || typeof value !== 'object') throw new Error('Le livrable doit être un objet JSON.');
  const draft = value as Deliverable;
  if (!draft.title?.trim() || !['report', 'contract'].includes(draft.kind) || !Array.isArray(draft.sections) || !draft.sections.length) throw new Error('Titre, type et sections du livrable requis.');
  const known = new Set(ledger.map(r => r.id)), seen = new Set<string>(), covered = new Set<string>();
  for (const s of draft.sections) {
    if (typeof s.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(s.id) || seen.has(s.id) || typeof s.title !== 'string' || !s.title.trim() || typeof s.content !== 'string' || !s.content.trim()) throw new Error('Sections incomplètes ou identifiants répétés.');
    seen.add(s.id);
    if (!Array.isArray(s.ledgerIds) || !s.ledgerIds.length || s.ledgerIds.some(id => !known.has(id))) throw new Error(`${s.id} : chaque section doit citer des lignes existantes du registre.`);
    s.ledgerIds.forEach(id => covered.add(id));
    if (s.table && (!Array.isArray(s.table.headers) || !s.table.headers.length || !s.table.headers.every(x=>typeof x==='string') || !Array.isArray(s.table.rows) || s.table.rows.some(r=>!Array.isArray(r)||r.length!==s.table!.headers.length||r.some(c=>typeof c!=='string')))) throw new Error(`${s.id} : tableau invalide.`);
  }
  const missing = ledger.filter(r => ['deviation','missing','added','unclear'].includes(r.status) || r.status==='claim' && r.verdict==='inaccurate').filter(r=>!covered.has(r.id));
  if (missing.length) throw new Error(`Constats absents du livrable : ${missing.map(r=>r.id).join(', ')}`);
  return draft;
}

export function parseLedger(text: string): LedgerRow[] {
  const rows = text.split('\n').filter(l=>l.trim()).map(l=>JSON.parse(l) as LedgerRow);
  if (!rows.length || rows.some(r=>typeof r.id!=='string'||!r.id||typeof r.topic!=='string'||!r.topic) || new Set(rows.map(r=>r.id)).size!==rows.length) throw new Error('Registre vide, invalide ou contenant des IDs répétés.');
  return rows;
}

export function safeId(id: string) { if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Identifiant invalide'); return id; }
export function safeName(name: string) { return name.replaceAll('\\','/').split('/').pop()!.replace(/[^\p{L}\p{N} ._-]/gu, '_').slice(-160) || 'document.txt'; }
