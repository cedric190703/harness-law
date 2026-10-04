export type Provider = 'claude' | 'vibe';
export type RunStatus = 'queued' | 'running' | 'checking' | 'completed' | 'blocked' | 'failed' | 'cancelled' | 'interrupted';
export type NodeStatus = 'pending' | 'running' | 'passed' | 'warning' | 'failed';
export type TraceKind = 'input' | 'document' | 'skill' | 'tool' | 'finding' | 'check' | 'section';
/** Deliverable shapes the app knows how to validate, render and export. */
export type DeliverableKind = 'report' | 'contract' | 'disclosure-schedule' | 'seller-questions' | 'contract-table' | 'counterparty-letters' | 'cap-table';
export interface TraceNode { id: string; kind: TraceKind; label: string; detail: string; status: NodeStatus; parents: string[]; step?: number; sourceId?: string; sectionId?: string; quote?: string; location?: string; timestamp?: string }
export interface TraceEvent { id: string; at: string; kind: 'system' | 'assistant' | 'tool' | 'check' | 'error'; text: string; nodeId?: string; tool?: string; toolId?: string }
export interface SourceDocument { id: string; name: string; file: string; size: number; sha256: string; extracted?: boolean; duplicateOf?: string; limitation?: string }
export interface LedgerRow { id: string; topic: string; status: string; ref_doc?: string; ref_quote?: string; ref_loc?: string; subj_doc?: string; subj_quote?: string; subj_loc?: string; ref_value?: string; subj_value?: string; impact?: string; severity?: string; recommendation?: string; links?: string[]; verdict?: string }
export interface DeliverableSection { id: string; title: string; content: string; ledgerIds: string[]; table?: { headers: string[]; rows: string[][] } }
export interface Deliverable { title: string; kind: DeliverableKind; sections: DeliverableSection[] }
export interface Run { id: string; projectId: string; prompt: string; provider: Provider; useCaseId?: string; status: RunStatus; startedAt: string; endedAt?: string; budget: number; cost?: number; inputTokens?: number; outputTokens?: number; events: TraceEvent[]; nodes: TraceNode[]; documents: SourceDocument[]; ledger: LedgerRow[]; deliverable?: Deliverable; artifacts: string[]; error?: string; attempt: number; skillHash: string }
export interface Project { id: string; name: string; description: string; createdAt: string; updatedAt: string; documents: SourceDocument[]; runs: Run[] }
export interface AgentInfo { id: Provider; name: string; installed: boolean }
export const STEPS = [
  { id: 1, title: 'Inventory and reading', description: 'Extract the documents, assign roles and record reading limits.' },
  { id: 2, title: 'Concordance table', description: 'Compare the terms and keep the exact quotes.' },
  { id: 3, title: 'Reverse pass', description: 'Look for additions, omissions and quiet amendments.' },
  { id: 4, title: 'Statements and context', description: 'Test the seller’s claims against the documents.' },
  { id: 5, title: 'Impact and materiality', description: 'Qualify each gap and propose an action for the client.' },
  { id: 6, title: 'Evidence check', description: 'Run the mechanical check on the ledger and its coverage.' },
  { id: 7, title: 'Drafting the deliverable', description: 'Tie every section to the findings behind it.' },
  { id: 8, title: 'Final review', description: 'Check the deliverable, then generate the exports.' },
] as const;
export const RUN_LABELS: Record<RunStatus, string> = { queued:'Queued', running:'Running', checking:'Checking', completed:'Ready to review', blocked:'Needs rework', failed:'Failed', cancelled:'Stopped', interrupted:'Interrupted' };
export const DELIVERABLE_LABELS: Record<DeliverableKind, string> = {
  report: 'Review report',
  contract: 'Contract',
  'disclosure-schedule': 'Disclosure schedules',
  'seller-questions': 'Requests to the seller',
  'contract-table': 'Key contracts table',
  'counterparty-letters': 'Counterparty letters',
  'cap-table': 'Chain of title and cap table',
};
