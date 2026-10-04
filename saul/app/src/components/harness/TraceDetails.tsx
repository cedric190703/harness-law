'use client';
import { ArrowDownLeft, ArrowUpRight, FileOutput, X, Quote, Clock3, Fingerprint } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { STEPS, type Run, type TraceNode } from '@/lib/harness/types';

export const kindLabels = {input:'Mission',document:'Document',skill:'Étape du skill',tool:'Appel d’outil',finding:'Constat',check:'Citation vérifiée',section:'Section du livrable'};
export const statusLabels = {passed:'Observé / contrôlé',warning:'À examiner',pending:'En attente',failed:'À reprendre',running:'En cours'};
const purpose = {
 input:'La consigne et le périmètre transmis à l’agent pour cette mission.',
 document:'La pièce utilisée dans cette exécution, avec son identité et ses limites de lecture.',
 skill:'Une étape de la méthode cross-document-review prescrite à l’agent.',
 tool:'Une opération observée pendant l’exécution du CLI.',
 finding:'Une ligne du registre qui rapproche les pièces et expose un constat à relire.',
 check:'Un extrait retrouvé dans le texte de la pièce. Ce contrôle atteste l’ancrage de la citation.',
 section:'Un passage rédigé à partir des constats référencés dans le registre.',
};
const states:Record<string,string>={match:'Conforme',deviation:'Écart',missing:'Absent du document revu',added:'Ajout',unclear:'Incertain',claim:'Déclaration', 'n/a':'Non applicable'};
const priorities:Record<string,string>={Critical:'Critique',High:'Haute',Medium:'Moyenne',Low:'Faible'};
export default function TraceDetails({node,nodes,run,onSelect,onClose,onSection}:{node:TraceNode;nodes:TraceNode[];run?:Run;onSelect:(id:string)=>void;onClose:()=>void;onSection?:(id:string)=>void}) {
 const source=run?.documents.find(d=>d.id===node.sourceId);
 const finding=run?.ledger.find(r=>`finding-${r.id}`===node.id);
 const section=run?.deliverable?.sections.find(s=>s.id===node.sectionId);
 const events=run?.events.filter(e=>e.nodeId===node.id)||[];
 const parents=nodes.filter(n=>node.parents.includes(n.id));
 const children=nodes.filter(n=>n.parents.includes(node.id));
 const step=STEPS.find(s=>s.id===node.step);
 return <aside className="graph-inspector" aria-label="Détails du nœud">
   <div className="inspector-heading"><span className={`node-type-label ${node.kind}`}>{kindLabels[node.kind]}{node.step?` · ${String(node.step).padStart(2,'0')}`:''}</span><button className="icon-button" aria-label="Fermer le détail" onClick={onClose}><X size={19}/></button></div>
   <h3>{node.label}</h3><span className={`pill ${node.status}`}>{statusLabels[node.status]}</span><p className="node-purpose">{purpose[node.kind]}</p>
   {node.kind==='skill'&&step&&<section className="detail-section"><h4>Objectif de l’étape</h4><p>{step.description}</p><p className="detail-note">Méthode : cross-document-review · étape {step.id}</p></section>}
   {!finding&&<section className="detail-section"><h4>{node.kind==='tool'?'Paramètres et résultat':node.kind==='input'?'Consigne complète':node.kind==='skill'?'Ce qui a été observé':'Détail enregistré'}</h4><p className={`preserve ${node.kind==='tool'?'tool-output':''}`}>{node.detail||'Aucun détail supplémentaire enregistré.'}</p></section>}
   {node.quote&&<section className="detail-section quote-section"><h4><Quote size={15}/>Extrait exact</h4><blockquote>{node.quote}</blockquote>{node.location&&<p className="quote-location">{node.location}</p>}<p className="detail-note">L’interprétation juridique de ce passage reste à valider.</p></section>}
   {source&&<section className="detail-section"><h4>Pièce source</h4><dl className="detail-fields"><div><dt>Nom original</dt><dd>{source.name}</dd></div><div><dt>Taille</dt><dd>{new Intl.NumberFormat('fr-FR').format(source.size)} octets</dd></div><div><dt>Extraction</dt><dd>{source.extracted?'Texte extrait':source.extracted===false?'Texte non exploitable':'Non attestée'}</dd></div>{source.duplicateOf&&<div><dt>Doublon de</dt><dd>{run?.documents.find(d=>d.id===source.duplicateOf)?.name||source.duplicateOf}</dd></div>}</dl><p className="detail-note">{source.limitation||'L’extraction ne garantit pas une lecture exhaustive par l’agent.'}</p><details className="technical-detail"><summary><Fingerprint size={14}/>Empreinte du fichier</summary><code>{source.sha256}</code></details></section>}
   {finding&&<>
     <section className="detail-section"><h4>Comparaison</h4><div className="finding-labels"><span>{states[finding.status]||finding.status}</span>{finding.severity&&<span className="finding-priority">Priorité {priorities[finding.severity]||finding.severity}</span>}</div><div className="value-comparison"><div><span>Référence</span><strong>{finding.ref_value||'Non renseignée'}</strong></div><ArrowUpRight size={19}/><div><span>Document revu</span><strong>{finding.subj_value||'Non renseignée'}</strong></div></div></section>
     {finding.impact&&<section className="detail-section"><h4>Impact pour le client</h4><p>{finding.impact}</p></section>}
     {finding.recommendation&&<section className="detail-section recommendation"><h4>Recommandation proposée</h4><p>{finding.recommendation}</p></section>}
     {(['ref','subj'] as const).map(side=>finding[`${side}_quote`]&&<section className="detail-section quote-section" key={side}><h4>{side==='ref'?'Preuve de référence':'Preuve du document revu'}</h4><p className="quote-location">{run?.documents.find(d=>d.file===finding[`${side}_doc`])?.name||finding[`${side}_doc`]} · {finding[`${side}_loc`]}</p><blockquote>{finding[`${side}_quote`]}</blockquote></section>)}
   </>}
   {section&&<section className="detail-section"><h4>Texte de la section</h4><div className="detail-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown></div>{section.table&&<div className="detail-table"><table><thead><tr>{section.table.headers.map((h,i)=><th key={i}>{h}</th>)}</tr></thead><tbody>{section.table.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>}<p className="detail-note">Constats rattachés : {section.ledgerIds.join(', ')}</p>{onSection&&<button className="primary" onClick={()=>onSection(section.id)}>Ouvrir dans le livrable <FileOutput size={16}/></button>}</section>}
   {events.length>0&&<section className="detail-section"><h4><Clock3 size={15}/>Journal observé <span>{events.length}</span></h4>{events.map(e=><details className="node-event" key={e.id}><summary><span>{e.tool||{system:'Orchestration',assistant:'Message de l’agent',tool:'Outil',check:'Contrôle',error:'Erreur'}[e.kind]}</span><time>{new Date(e.at).toLocaleTimeString('fr-FR')}</time></summary><pre>{e.text}</pre></details>)}</section>}
   {[{label:'Éléments en entrée',items:parents,Icon:ArrowDownLeft},{label:'Utilisé par',items:children,Icon:ArrowUpRight}].map(({label,items,Icon})=><section className="detail-section node-connections" key={label}><h4><Icon size={16}/>{label}<span>{items.length}</span></h4>{items.length?items.map(n=><button key={n.id} onClick={()=>onSelect(n.id)}><i className={`connection-dot ${n.kind}`}/><span><small>{kindLabels[n.kind]}</small>{n.label}</span><ArrowUpRight size={15}/></button>):<p className="detail-note">Aucun lien enregistré dans cette vue.</p>}</section>)}
   <details className="technical-detail"><summary>Informations de traçabilité</summary><dl className="detail-fields"><div><dt>Identifiant</dt><dd>{node.id}</dd></div>{node.timestamp&&<div><dt>Horodatage</dt><dd>{new Date(node.timestamp).toLocaleString('fr-FR')}</dd></div>}{run&&<><div><dt>Agent</dt><dd>{run.provider==='claude'?'Claude Code':'Mistral Vibe'}</dd></div><div><dt>Version du skill</dt><dd><code>{run.skillHash}</code></dd></div></>}</dl></details>
 </aside>
}
