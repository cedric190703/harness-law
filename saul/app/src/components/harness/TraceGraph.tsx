'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Handle, Position, MarkerType, type NodeProps, type Node, type Edge, type ReactFlowInstance, ReactFlowProvider } from '@xyflow/react';
import { FileText, GitBranch, CheckCheck, FileOutput, Terminal, Layers, MessageSquare, Maximize2, Minimize2, Scan, Download, X, ArrowUpRight, Check, CircleAlert, Clock3, LoaderCircle, MousePointer2, BookOpen } from 'lucide-react';
import type { TraceNode, TraceKind, Run } from '@/lib/harness/types';
import { ancestors, visibleTraceNodes } from '@/lib/harness/provenance';
import TraceDetails, { kindLabels, statusLabels } from './TraceDetails';
import '@xyflow/react/dist/style.css';

const icons={input:MessageSquare,document:FileText,skill:Layers,tool:Terminal,finding:GitBranch,check:CheckCheck,section:FileOutput};
const colors={input:'#a16b16',document:'#356ea1',skill:'#7b5ca7',tool:'#666180',finding:'#a46a1e',check:'#307c72',section:'#386644'};
const statusIcons={passed:Check,warning:CircleAlert,failed:CircleAlert,pending:Clock3,running:LoaderCircle};
type FlowNode=Node<{trace:TraceNode;vertical:boolean;summary:string;outgoing:number;related:boolean}>;
function TraceCard({data,selected}:NodeProps<FlowNode>){
 const n=data.trace,Icon=icons[n.kind],StatusIcon=statusIcons[n.status];
 return <div className={`trace-card ${n.kind} ${n.status} ${selected?'selected':''} ${data.related?'related':''}`}>
   <Handle type="target" position={data.vertical?Position.Top:Position.Left}/>
   <div className="trace-overline"><span className="trace-icon"><Icon size={19}/></span><span>{kindLabels[n.kind]}{n.step?` · ${String(n.step).padStart(2,'0')}`:''}</span><ArrowUpRight size={15}/></div>
   <strong title={n.label}>{n.label}</strong><p className={`trace-preview ${n.quote?'is-quote':''}`}>{n.quote?`« ${n.quote} »`:data.summary}</p>
   <div className="trace-caption"><span className={`trace-status ${n.status}`}><StatusIcon size={13} className={n.status==='running'?'spin':undefined}/>{n.kind==='check'&&n.status==='passed'?'Excerpt found':statusLabels[n.status]}</span><span title="Incoming and outgoing links">{n.parents.length} → {data.outgoing}</span></div>
   <Handle type="source" position={data.vertical?Position.Bottom:Position.Right}/>
 </div>
}
const nodeTypes={trace:TraceCard};
export default function TraceGraph({nodes,run,focus,onClear,onSection}:{nodes:TraceNode[];run?:Run;focus?:string;onClear?:()=>void;onSection?:(id:string)=>void}){
 const [selected,setSelected]=useState<string>(),[tools,setTools]=useState(false),[common,setCommon]=useState(false),[fullscreen,setFullscreen]=useState(false);
 const [moved,setMoved]=useState<Record<string,{x:number;y:number}>>({});
 const shell=useRef<HTMLDivElement>(null),fullButton=useRef<HTMLButtonElement>(null),flow=useRef<ReactFlowInstance<FlowNode,Edge>>(null);
 const sectionFocus=nodes.some(n=>n.id===focus&&n.kind==='section');
 const scope=useMemo(()=>{if(!focus)return nodes;const ids=ancestors(nodes,focus);return nodes.filter(n=>ids.has(n.id))},[nodes,focus]);
 const detail=nodes.find(n=>n.id===selected);
 const layout=useMemo(()=>{
   const visible=visibleTraceNodes(nodes,focus,tools,common);
   const related=selected?ancestors(nodes,selected):new Set<string>();
   const positions=new Map<string,{x:number;y:number}>();
   if(focus){
     let y=0;
     for(const kind of ['input','skill','document','tool','check','finding','section'] as TraceKind[]){
       const group=visible.filter(n=>n.kind===kind);
       group.forEach((n,i)=>positions.set(n.id,{x:group.length===1?176:(i%2)*352,y:y+Math.floor(i/2)*258}));
       y+=Math.ceil(group.length/2)*258;
     }
   }else{
     const stages=visible.filter(n=>n.kind==='skill');
     stages.forEach((n,i)=>positions.set(n.id,{x:(i%4)*368,y:Math.floor(i/4)*258}));
     const start=Math.ceil(stages.length/4)*258+100;
     const columns:TraceKind[]=['input','document',...(tools?['tool' as const]:[]),'check','finding','section'];
     columns.forEach((kind,col)=>visible.filter(n=>n.kind===kind).forEach((n,i)=>positions.set(n.id,{x:col*368,y:start+i*258})));
   }
   const flowNodes:FlowNode[]=visible.map(n=>{
     const finding=run?.ledger.find(r=>`finding-${r.id}`===n.id);
     const source=run?.documents.find(d=>d.id===n.sourceId);
     const section=run?.deliverable?.sections.find(s=>s.id===n.sectionId);
     const summary=finding?[finding.ref_value,finding.subj_value].filter(Boolean).join(' → '):n.kind==='document'&&source?`${new Intl.NumberFormat('en-GB').format(source.size)} bytes · ${source.extracted?'Text extracted':'Reading to check'}`:section?section.content.replace(/[#*`]/g,''):n.detail;
     return {id:n.id,type:'trace',width:300,height:216,position:moved[`${focus||'all'}-${n.id}`]||positions.get(n.id)||{x:0,y:0},data:{trace:n,vertical:!!focus,summary,outgoing:nodes.filter(child=>child.parents.includes(n.id)).length,related:related.has(n.id)},selected:n.id===selected,ariaLabel:`${kindLabels[n.kind]} : ${n.label}. ${statusLabels[n.status]}`};
   });
   const ids=new Set(visible.map(n=>n.id));
   const edges:Edge[]=visible.flatMap(n=>n.parents.filter(p=>ids.has(p)).map(p=>{
     const highlighted=selected&&(related.has(n.id)&&related.has(p)||p===selected);
     return {id:p+'--'+n.id,source:p,target:n.id,type:'smoothstep',animated:n.status==='running',markerEnd:{type:MarkerType.ArrowClosed,color:highlighted?'#386644':'#879b97',width:16,height:16},style:{stroke:highlighted?'#386644':'#9aaca6',strokeWidth:highlighted?2.8:1.5,strokeDasharray:n.kind==='skill'?'6 4':undefined,opacity:selected&&!highlighted?.35:1}};
   }));
   return {nodes:flowNodes,edges};
 },[nodes,run,tools,common,focus,selected,moved]);
 useEffect(()=>{
   if(!fullscreen)return;
   const previous=document.activeElement as HTMLElement|null;
   const overflow=document.body.style.overflow;document.body.style.overflow='hidden';fullButton.current?.focus();
   const fullscreenChanged=()=>{if(!document.fullscreenElement)setFullscreen(false)};
   const keyboard=(e:KeyboardEvent)=>{
     if(e.key==='Escape'){if(document.fullscreenElement===shell.current)void document.exitFullscreen().catch(()=>{});setFullscreen(false)}
     if(e.key==='Tab'){
       const elements=Array.from(shell.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,summary,[tabindex="0"]')||[]).filter(el=>el.getClientRects().length);
       const first=elements[0],last=elements.at(-1);
       if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
       else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
     }
   };
   document.addEventListener('fullscreenchange',fullscreenChanged);document.addEventListener('keydown',keyboard);
   return()=>{document.body.style.overflow=overflow;document.removeEventListener('fullscreenchange',fullscreenChanged);document.removeEventListener('keydown',keyboard);previous?.focus()};
 },[fullscreen]);
 useEffect(()=>{
   const timer=setTimeout(()=>{if(focus)void flow.current?.fitView({padding:.14,minZoom:.5,maxZoom:1,duration:250});else void flow.current?.setViewport({x:40,y:40,zoom:.8},{duration:250})},120);
   return()=>clearTimeout(timer);
 },[fullscreen,focus,tools,common]);
 useEffect(()=>{
   if(!selected)return;
   const timer=setTimeout(()=>{const target=flow.current?.getNode(selected);if(target)void flow.current?.setCenter(target.position.x+150,target.position.y+108,{zoom:.95,duration:300})},180);
   return()=>clearTimeout(timer);
 },[selected,fullscreen,tools,common]);
 async function toggleFullscreen(){
   if(fullscreen){if(document.fullscreenElement===shell.current)await document.exitFullscreen().catch(()=>{});setFullscreen(false);return;}
   setFullscreen(true);
   try{await shell.current?.requestFullscreen?.()}catch{/* The enlarged-window mode stays available if the browser refuses native fullscreen. */}
 }
 function select(id:string){
   const target=nodes.find(n=>n.id===id);if(!target)return;
   if(target.kind==='tool')setTools(true);
   if(sectionFocus&&['input','skill'].includes(target.kind))setCommon(true);
   setSelected(id);
 }
 function readable(){const target=layout.nodes.find(n=>n.id===selected)||layout.nodes.find(n=>n.id===focus)||layout.nodes[0];if(target)void flow.current?.setCenter(target.position.x+150,target.position.y+105,{zoom:1,duration:300})}
 function download(){const blob=new Blob([JSON.stringify({nodes:scope,focus},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='provenance-graph.json';a.click();URL.revokeObjectURL(url)}
 async function openSection(id:string){if(document.fullscreenElement===shell.current)await document.exitFullscreen().catch(()=>{});setFullscreen(false);onSection?.(id)}
 const title=sectionFocus?'Origin of this section':focus?'Trace of this step':'Mission graph';
 return <div ref={shell} className={`graph-shell graph-refined ${fullscreen?'graph-fullscreen':''}`} role={fullscreen?'dialog':undefined} aria-modal={fullscreen||undefined} aria-label={title}>
   <div className="graph-toolbar"><div className="graph-title"><span className="graph-title-icon"><GitBranch size={21}/></span><div><b>{title}</b><span>{layout.nodes.length} nodes · {layout.edges.length} documented links</span></div></div><div className="inline-actions">{focus&&<button onClick={onClear}><X size={15}/>Full view</button>}<button title="Show the whole trace" aria-label="Overview" onClick={()=>void flow.current?.fitView({padding:.14,maxZoom:1,duration:300})}><Scan size={17}/><span>Overview</span></button><button title="Read the cards at full size" aria-label="Read at 100%" onClick={readable}><BookOpen size={17}/><span>Read 100%</span></button><button ref={fullButton} className="fullscreen-button" aria-label={fullscreen?'Leave fullscreen':'Open the graph fullscreen'} onClick={()=>void toggleFullscreen()}>{fullscreen?<Minimize2 size={17}/>:<Maximize2 size={17}/>}<span>{fullscreen?'Leave fullscreen':'Fullscreen'}</span></button><button aria-label="Export the graph" title="Export the graph as JSON" onClick={download}><Download size={17}/></button></div></div>
   <div className="graph-filters"><div><label className="tool-toggle"><input type="checkbox" checked={tools} onChange={e=>setTools(e.target.checked)}/>Tool calls</label>{sectionFocus&&<label className="tool-toggle"><input type="checkbox" checked={common} onChange={e=>setCommon(e.target.checked)}/>Shared skill steps</label>}</div><span><MousePointer2 size={14}/>{fullscreen?'Esc to leave · ':' '}Click a node to explore it</span></div>
   <div className="graph-body"><ReactFlowProvider><ReactFlow<FlowNode,Edge> nodes={layout.nodes} edges={layout.edges} nodeTypes={nodeTypes} onInit={instance=>{flow.current=instance}} onNodesChange={changes=>{const updates=changes.filter(c=>c.type==='position'&&c.position);if(updates.length)setMoved(old=>{const next={...old};for(const c of updates)if(c.type==='position'&&c.position)next[`${focus||'all'}-${c.id}`]=c.position;return next})}} onNodeClick={(_,n)=>select(n.id)} onPaneClick={()=>setSelected(undefined)} defaultViewport={{x:40,y:40,zoom:.8}} minZoom={.12} maxZoom={2} nodesConnectable={false} elementsSelectable attributionPosition="bottom-left"><Background color="#bdcec5" gap={24} size={1}/><Controls showInteractive={false}/><MiniMap pannable zoomable nodeColor={n=>colors[(n.data.trace as TraceNode).kind]} maskColor="rgba(243,247,244,.7)"/></ReactFlow></ReactFlowProvider>{!nodes.length&&<div className="graph-empty"><GitBranch size={30}/><b>Your trace will appear here</b><span>Launch a mission to follow its steps and its evidence.</span></div>}{detail&&<TraceDetails key={detail.id} node={detail} nodes={scope} run={run} onSelect={select} onClose={()=>setSelected(undefined)} onSection={onSection?openSection:undefined}/>}</div>
   <div className="graph-legend">{(['document','skill','tool','check','finding','section'] as TraceKind[]).filter(kind=>tools||kind!=='tool').map(kind=><span key={kind}><i style={{background:colors[kind]}}/>{kindLabels[kind]}</span>)}<span className="graph-navigation-hint">Drag to explore · Scroll to zoom</span></div>
 </div>
}
