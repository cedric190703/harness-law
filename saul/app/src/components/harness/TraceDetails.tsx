'use client';
import { ArrowDownLeft, ArrowUpRight, FileOutput, X, Quote, Clock3, Fingerprint } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { STEPS, type Run, type TraceNode } from '@/lib/harness/types';

export const kindLabels = {input:'Mission',document:'Document',skill:'Skill step',tool:'Tool call',finding:'Finding',check:'Quote verified',section:'Deliverable section'};
export const statusLabels = {passed:'Observed / checked',warning:'To review',pending:'Pending',failed:'Needs rework',running:'Running'};
const purpose = {
 input:'The instruction and scope handed to the agent for this mission.',
 document:'The document used in this run, with its identity and its reading limits.',
 skill:'A step of the cross-document-review method prescribed to the agent.',
 tool:'An operation observed while the CLI was running.',
 finding:'A ledger row that brings the documents together and states a finding for review.',
 check:'An excerpt found in the document text. This check attests the anchor of the quote.',
 section:'A passage drafted from the findings referenced in the ledger.',
};
const states:Record<string,string>={match:'Conforming',deviation:'Gap',missing:'Absent from the subject',added:'Addition',unclear:'Unclear',claim:'Statement', 'n/a':'Not applicable'};
const priorities:Record<string,string>={Critical:'Critical',High:'High',Medium:'Medium',Low:'Low'};
export default function TraceDetails({node,nodes,run,onSelect,onClose,onSection}:{node:TraceNode;nodes:TraceNode[];run?:Run;onSelect:(id:string)=>void;onClose:()=>void;onSection?:(id:string)=>void}) {
 const source=run?.documents.find(d=>d.id===node.sourceId);
 const finding=run?.ledger.find(r=>`finding-${r.id}`===node.id);
 const section=run?.deliverable?.sections.find(s=>s.id===node.sectionId);
 const events=run?.events.filter(e=>e.nodeId===node.id)||[];
 const parents=nodes.filter(n=>node.parents.includes(n.id));
 const children=nodes.filter(n=>n.parents.includes(node.id));
 const step=STEPS.find(s=>s.id===node.step);
 return <aside className="graph-inspector" aria-label="Node details">
   <div className="inspector-heading"><span className={`node-type-label ${node.kind}`}>{kindLabels[node.kind]}{node.step?` · ${String(node.step).padStart(2,'0')}`:''}</span><button className="icon-button" aria-label="Close the detail panel" onClick={onClose}><X size={19}/></button></div>
   <h3>{node.label}</h3><span className={`pill ${node.status}`}>{statusLabels[node.status]}</span><p className="node-purpose">{purpose[node.kind]}</p>
   {node.kind==='skill'&&step&&<section className="detail-section"><h4>What this step is for</h4><p>{step.description}</p><p className="detail-note">Method: cross-document-review · step {step.id}</p></section>}
   {!finding&&<section className="detail-section"><h4>{node.kind==='tool'?'Parameters and result':node.kind==='input'?'Full instruction':node.kind==='skill'?'What was observed':'Recorded detail'}</h4><p className={`preserve ${node.kind==='tool'?'tool-output':''}`}>{node.detail||'No further detail recorded.'}</p></section>}
   {node.quote&&<section className="detail-section quote-section"><h4><Quote size={15}/>Exact excerpt</h4><blockquote>{node.quote}</blockquote>{node.location&&<p className="quote-location">{node.location}</p>}<p className="detail-note">The legal reading of this passage still needs to be confirmed.</p></section>}
   {source&&<section className="detail-section"><h4>Source document</h4><dl className="detail-fields"><div><dt>Original name</dt><dd>{source.name}</dd></div><div><dt>Size</dt><dd>{new Intl.NumberFormat('en-GB').format(source.size)} bytes</dd></div><div><dt>Extraction</dt><dd>{source.extracted?'Text extracted':source.extracted===false?'Text unusable':'Not attested'}</dd></div>{source.duplicateOf&&<div><dt>Duplicate of</dt><dd>{run?.documents.find(d=>d.id===source.duplicateOf)?.name||source.duplicateOf}</dd></div>}</dl><p className="detail-note">{source.limitation||'Extraction does not guarantee the agent read it in full.'}</p><details className="technical-detail"><summary><Fingerprint size={14}/>File hash</summary><code>{source.sha256}</code></details></section>}
   {finding&&<>
     <section className="detail-section"><h4>Comparison</h4><div className="finding-labels"><span>{states[finding.status]||finding.status}</span>{finding.severity&&<span className="finding-priority">Priority {priorities[finding.severity]||finding.severity}</span>}</div><div className="value-comparison"><div><span>Reference</span><strong>{finding.ref_value||'Not stated'}</strong></div><ArrowUpRight size={19}/><div><span>Subject document</span><strong>{finding.subj_value||'Not stated'}</strong></div></div></section>
     {finding.impact&&<section className="detail-section"><h4>Impact for the client</h4><p>{finding.impact}</p></section>}
     {finding.recommendation&&<section className="detail-section recommendation"><h4>Recommendation proposed</h4><p>{finding.recommendation}</p></section>}
     {(['ref','subj'] as const).map(side=>finding[`${side}_quote`]&&<section className="detail-section quote-section" key={side}><h4>{side==='ref'?'Reference evidence':'Subject evidence'}</h4><p className="quote-location">{run?.documents.find(d=>d.file===finding[`${side}_doc`])?.name||finding[`${side}_doc`]} · {finding[`${side}_loc`]}</p><blockquote>{finding[`${side}_quote`]}</blockquote></section>)}
   </>}
   {section&&<section className="detail-section"><h4>Section text</h4><div className="detail-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown></div>{section.table&&<div className="detail-table"><table><thead><tr>{section.table.headers.map((h,i)=><th key={i}>{h}</th>)}</tr></thead><tbody>{section.table.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>}<p className="detail-note">Findings attached: {section.ledgerIds.join(', ')}</p>{onSection&&<button className="primary" onClick={()=>onSection(section.id)}>Open in the deliverable <FileOutput size={16}/></button>}</section>}
   {events.length>0&&<section className="detail-section"><h4><Clock3 size={15}/>Observed log <span>{events.length}</span></h4>{events.map(e=><details className="node-event" key={e.id}><summary><span>{e.tool||{system:'Orchestration',assistant:'Agent message',tool:'Tool',check:'Check',error:'Error'}[e.kind]}</span><time>{new Date(e.at).toLocaleTimeString('en-GB')}</time></summary><pre>{e.text}</pre></details>)}</section>}
   {[{label:'Inputs',items:parents,Icon:ArrowDownLeft},{label:'Used by',items:children,Icon:ArrowUpRight}].map(({label,items,Icon})=><section className="detail-section node-connections" key={label}><h4><Icon size={16}/>{label}<span>{items.length}</span></h4>{items.length?items.map(n=><button key={n.id} onClick={()=>onSelect(n.id)}><i className={`connection-dot ${n.kind}`}/><span><small>{kindLabels[n.kind]}</small>{n.label}</span><ArrowUpRight size={15}/></button>):<p className="detail-note">No link recorded in this view.</p>}</section>)}
   <details className="technical-detail"><summary>Traceability information</summary><dl className="detail-fields"><div><dt>Identifier</dt><dd>{node.id}</dd></div>{node.timestamp&&<div><dt>Timestamp</dt><dd>{new Date(node.timestamp).toLocaleString('en-GB')}</dd></div>}{run&&<><div><dt>Agent</dt><dd>{run.provider==='claude'?'Claude Code':'Mistral Vibe'}</dd></div><div><dt>Skill version</dt><dd><code>{run.skillHash}</code></dd></div></>}</dl></details>
 </aside>
}
