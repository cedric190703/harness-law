export type Provider = 'claude' | 'vibe';
export type RunStatus = 'queued' | 'running' | 'checking' | 'completed' | 'blocked' | 'failed' | 'cancelled' | 'interrupted';
export type NodeStatus = 'pending' | 'running' | 'passed' | 'warning' | 'failed';
export type TraceKind = 'input' | 'document' | 'skill' | 'tool' | 'finding' | 'check' | 'section';
export interface TraceNode { id: string; kind: TraceKind; label: string; detail: string; status: NodeStatus; parents: string[]; step?: number; sourceId?: string; sectionId?: string; quote?: string; location?: string; timestamp?: string }
export interface TraceEvent { id: string; at: string; kind: 'system' | 'assistant' | 'tool' | 'check' | 'error'; text: string; nodeId?: string; tool?: string; toolId?: string }
export interface SourceDocument { id: string; name: string; file: string; size: number; sha256: string; extracted?: boolean; duplicateOf?: string; limitation?: string }
export interface LedgerRow { id: string; topic: string; status: string; ref_doc?: string; ref_quote?: string; ref_loc?: string; subj_doc?: string; subj_quote?: string; subj_loc?: string; ref_value?: string; subj_value?: string; impact?: string; severity?: string; recommendation?: string; links?: string[]; verdict?: string }
export interface DeliverableSection { id: string; title: string; content: string; ledgerIds: string[]; table?: { headers: string[]; rows: string[][] } }
export interface Deliverable { title: string; kind: 'report' | 'contract'; sections: DeliverableSection[] }
export interface Run { id: string; projectId: string; prompt: string; provider: Provider; status: RunStatus; startedAt: string; endedAt?: string; budget: number; cost?: number; inputTokens?: number; outputTokens?: number; events: TraceEvent[]; nodes: TraceNode[]; documents: SourceDocument[]; ledger: LedgerRow[]; deliverable?: Deliverable; artifacts: string[]; error?: string; attempt: number; skillHash: string }
export interface Project { id: string; name: string; description: string; createdAt: string; updatedAt: string; documents: SourceDocument[]; runs: Run[] }
export interface AgentInfo { id: Provider; name: string; installed: boolean }
export const STEPS = [
  { id: 1, title: 'Inventaire et lecture', description: 'Extraire les pièces, identifier les rôles et les limites de lecture.' },
  { id: 2, title: 'Tableau de concordance', description: 'Comparer les termes et conserver les citations exactes.' },
  { id: 3, title: 'Contre-lecture', description: 'Rechercher les ajouts, omissions et modifications discrètes.' },
  { id: 4, title: 'Déclarations et contexte', description: 'Confronter les affirmations du vendeur aux pièces.' },
  { id: 5, title: 'Impact et matérialité', description: 'Qualifier les écarts et proposer une action pour le client.' },
  { id: 6, title: 'Contrôle des preuves', description: 'Exécuter le contrôle mécanique du registre et de sa couverture.' },
  { id: 7, title: 'Rédaction du livrable', description: 'Relier chaque section aux constats qui la fondent.' },
  { id: 8, title: 'Revue finale', description: 'Contrôler le livrable, puis générer les exports.' },
] as const;
export const RUN_LABELS: Record<RunStatus, string> = { queued:'En attente', running:'En cours', checking:'Contrôles', completed:'Prêt à relire', blocked:'À reprendre', failed:'Échec', cancelled:'Arrêté', interrupted:'Interrompu' };
