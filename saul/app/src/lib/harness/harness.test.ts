import { describe, expect, test } from 'bun:test';
import { normalizeEvent, cliArguments } from './adapters';
import { ancestors, visibleTraceNodes, parseLedger, safeId, safeName, validateDeliverable } from './provenance';
import { USE_CASES } from './usecases';
import type { Deliverable, LedgerRow, TraceNode } from './types';
const ledger:LedgerRow[]=[{id:'R-1',topic:'Notice period',status:'deviation'},{id:'R-2',topic:'Governing law',status:'match'}];
const valid={title:'Report',kind:'report',sections:[{id:'notice',title:'Notice period',content:'30 days instead of 60.',ledgerIds:['R-1']}]};
describe('Harness output contract',()=>{
 test('accepts sections tied to findings that exist',()=>expect(validateDeliverable(valid,ledger).sections).toHaveLength(1));
 test('rejects a section without provenance',()=>expect(()=>validateDeliverable({...valid,sections:[{...valid.sections[0],ledgerIds:[]}]},ledger)).toThrow());
 test('rejects an invented finding id',()=>expect(()=>validateDeliverable({...valid,sections:[{...valid.sections[0],ledgerIds:['R-99']}]},ledger)).toThrow());
 test('rejects a gap missing from the deliverable',()=>expect(()=>validateDeliverable({...valid,sections:[{...valid.sections[0],ledgerIds:['R-2']}]},ledger)).toThrow('absent from the deliverable'));
 test('rejects duplicate ids and ragged tables',()=>{
   expect(()=>validateDeliverable({...valid,sections:[valid.sections[0],valid.sections[0]]},ledger)).toThrow();
   expect(()=>validateDeliverable({...valid,sections:[{...valid.sections[0],table:{headers:['A','B'],rows:[['C']]}}]},ledger)).toThrow();
 });
 test('counts uncertainties and inaccurate claims in the coverage check',()=>{
   expect(()=>validateDeliverable(valid,[...ledger,{id:'R-3',topic:'Litigation',status:'unclear'}])).toThrow();
   expect(()=>validateDeliverable(valid,[...ledger,{id:'R-3',topic:'Statement',status:'claim',verdict:'inaccurate'}])).toThrow();
 });
 test('does not hide a corrupted JSON line',()=>expect(()=>parseLedger('{"id":"R-1","topic":"A"}\n{')).toThrow());
 test('rejects an empty ledger and repeated ids',()=>{expect(()=>parseLedger('')).toThrow();expect(()=>parseLedger('{"id":"R-1","topic":"A"}\n{"id":"R-1","topic":"B"}')).toThrow()});
});
describe('Deliverable types',()=>{
 const one:LedgerRow[]=[{id:'R-1',topic:'Pending claim',status:'deviation'}];
 const section=(id:string,headers:string[],rows:string[][])=>({id,title:id,content:'Drafted text.',ledgerIds:['R-1'],table:{headers,rows}});
 const draft=(kind:string,sections:unknown[])=>({title:'T',kind,sections} as unknown as Deliverable);
 const check=(kind:string,useCaseId:string,sections:unknown[])=>validateDeliverable(draft(kind,sections),one,useCaseId);

 test('every use case declares a kind of its own',()=>expect(new Set(USE_CASES.map(u=>u.kind)).size).toBe(USE_CASES.length));

 test('a disclosure schedule needs its data-room reference on every exception',()=>{
   const ok=[section('corporate',['Warranty','Exception','Document','Location','Excerpt'],[['No litigation','Claim pending','pleadings.pdf','p. 2','a claim was filed']])];
   expect(check('disclosure-schedule','disclosure-schedule',ok).sections).toHaveLength(1);
   const blank=[section('corporate',['Warranty','Exception','Document','Location','Excerpt'],[['No litigation','Claim pending','','p. 2','a claim was filed']])];
   expect(()=>check('disclosure-schedule','disclosure-schedule',blank)).toThrow('Document');
   const noExcerpt=[section('corporate',['Warranty','Exception','Document','Location','Excerpt'],[['No litigation','Claim pending','pleadings.pdf','p. 2','']])];
   expect(()=>check('disclosure-schedule','disclosure-schedule',noExcerpt)).toThrow('Excerpt');
   const wrongShape=[section('corporate',['Warranty','Exception'],[['No litigation','Claim pending']])];
   expect(()=>check('disclosure-schedule','disclosure-schedule',wrongShape)).toThrow('disclosure schedule');
 });

 test('a request to the seller must cite a finding that exists',()=>{
   const headers=['Ref','Request or question','Why it is asked','Finding','Priority'];
   const ok=[section('corporate',headers,[['Q-1','Provide the share register','No register in the room','R-1','High']])];
   expect(check('seller-questions','seller-questions',ok).sections).toHaveLength(1);
   const unknown=[section('corporate',headers,[['Q-1','Provide the share register','No register in the room','R-99','High']])];
   expect(()=>check('seller-questions','seller-questions',unknown)).toThrow('R-99');
   const unsourced=[section('corporate',headers,[['Q-1','Provide the share register','No register in the room','','High']])];
   expect(()=>check('seller-questions','seller-questions',unsourced)).toThrow('Finding');
 });

 test('a key contracts table needs both the overview and a summary sheet',()=>{
   const overview=section('overview',['Contract','Parties','Term','Change of control','Exclusivity','Termination'],[['Supply','A and B','5 years','Consent required','Yes','90 days']]);
   const sheet=section('sheet-1',['Field','Value','Clause','Excerpt'],[['Change of control','Consent required','Art. 14','prior written consent of the other party']]);
   expect(check('contract-table','contract-table',[overview,sheet]).sections).toHaveLength(2);
   expect(()=>check('contract-table','contract-table',[overview])).toThrow('summary sheet');
   const noCoC=section('overview',['Contract','Parties','Term','Exclusivity','Termination'],[['Supply','A and B','5 years','Yes','90 days']]);
   expect(()=>check('contract-table','contract-table',[noCoC,sheet])).toThrow('overview');
   const noQuote=section('sheet-1',['Field','Value','Clause','Excerpt'],[['Change of control','Consent required','Art. 14','']]);
   expect(()=>check('contract-table','contract-table',[overview,noQuote])).toThrow('Excerpt');
 });

 test('the letters are produced in series: one per schedule row',()=>{
   const schedule=section('schedule',['Counterparty','Contract','Clause','Consent or notice','Deadline'],[
     ['Rivage','Supply','Art. 14','Consent','30 days'],['Atelier','Lease','Art. 9','Notice','15 days']]);
   const letter=(id:string)=>({id,title:id,content:'Dear Sirs, …',ledgerIds:['R-1']});
   expect(check('counterparty-letters','counterparty-letters',[schedule,letter('letter-1'),letter('letter-2')]).sections).toHaveLength(3);
   expect(()=>check('counterparty-letters','counterparty-letters',[schedule,letter('letter-1')])).toThrow('one letter-N section per schedule row');
   expect(()=>check('counterparty-letters','counterparty-letters',[schedule])).toThrow('one section per letter');
 });

 test('a cap table needs sourced movements and the holdings they produce',()=>{
   const movements=section('movements',['Date','Operation','Transferor','Transferee','Shares','Document','Excerpt'],[
     ['2019-04-02','Transfer','Dupont','Martin','1 000','register.pdf','transfer of 1,000 shares']]);
   const holdings=section('holdings',['Shareholder','Shares','% of capital','% of voting rights'],[['Martin','1 000','100','100']]);
   expect(check('cap-table','cap-table',[movements,holdings]).sections).toHaveLength(2);
   expect(()=>check('cap-table','cap-table',[movements])).toThrow('cap table');
   const unsourced=section('movements',['Date','Operation','Transferor','Transferee','Shares','Document','Excerpt'],[
     ['2019-04-02','Transfer','Dupont','Martin','1 000','','']]);
   expect(()=>check('cap-table','cap-table',[unsourced,holdings])).toThrow('Document');
 });

 test('the declared kind must match the mission that was launched',()=>{
   const ok=[section('corporate',['Warranty','Exception','Document','Location','Excerpt'],[['W','E','d.pdf','p.1','quote']])];
   expect(()=>check('report','disclosure-schedule',ok)).toThrow('must declare');
 });
});
describe('Targeted provenance',()=>{
 const n=(id:string,parents:string[]):TraceNode=>({id,parents,kind:'finding',label:id,detail:'',status:'passed'});
 const nodes=[n('input',[]),n('doc-a',['input']),n('doc-b',['input']),n('finding-a',['doc-a']),n('finding-b',['doc-b']),n('section-a',['finding-a']),n('section-b',['finding-b'])];
 test('clicking section A excludes the documents, findings and section B of the other branch',()=>expect([...ancestors(nodes,'section-a')]).toEqual(['section-a','finding-a','doc-a','input']));
 test('tolerates cycles and missing references without looping',()=>expect([...ancestors([n('a',['b','missing']),n('b',['a'])],'a')]).toEqual(['a','b']));
 const traced:TraceNode[]=[{...n('input',[]),kind:'input'},{...n('skill',['input']),kind:'skill'},{...n('tool',['skill']),kind:'tool'},n('proof',['tool']),{...n('section',['proof','skill']),kind:'section'}];
 test('the section view hides the shared steps and can bring them back',()=>{
   expect(visibleTraceNodes(traced,'section').map(n=>n.id)).toEqual(['proof','section']);
   expect(visibleTraceNodes(traced,'section',true,true)).toHaveLength(5);
 });
 test('clicking a skill step keeps that step and its ancestors',()=>expect(visibleTraceNodes(traced,'skill').map(n=>n.id)).toEqual(['input','skill']));
 test('a selected tool stays visible even when the other tools are hidden',()=>expect(visibleTraceNodes(traced,'tool').map(n=>n.id)).toEqual(['input','skill','tool']));
});
describe('CLI adapters and confidentiality',()=>{
 test('keeps no Claude internal reasoning block',()=>expect(normalizeEvent({type:'assistant',message:{role:'assistant',content:[{type:'thinking',thinking:'secret'},{type:'text',text:'I am comparing the clauses.'}]}})).toEqual([{kind:'assistant',text:'I am comparing the clauses.'}]));
 test('keeps no Vibe reasoning entry',()=>expect(normalizeEvent({type:'reasoning',text:'secret',summary:['secret']})).toEqual([]));
 test('normalises a Claude call and its result under one shared id',()=>{
  const call=normalizeEvent({type:'assistant',message:{role:'assistant',content:[{type:'tool_use',id:'t1',name:'Read',input:{file_path:'text/a.txt'}}]}})[0];
  const result=normalizeEvent({type:'user',message:{role:'user',content:[{type:'tool_result',tool_use_id:'t1',content:'Quote'}]}})[0];
  expect(call.toolId).toBe(result.toolId);expect(call.input?.file_path).toBe('text/a.txt');
 });
 test('normalises the public Vibe protocol effects from camelCase',()=>{
   const [call,result]=normalizeEvent({type:'effect',id:'v1',title:'Read',detail:{toolName:'read_file',input:{filePath:'text/source.txt'}},state:{status:'completed',outputText:'text'}});
   expect(call.tool).toBe('read_file');expect(call.input?.file_path).toBe('text/source.txt');expect(result.text).toBe('text');
 });
 test('grants neither a shell nor a global permission bypass',()=>{
  for(const provider of ['claude','vibe'] as const){const args=cliArguments(provider,'prompt',2);expect(args).not.toContain('--dangerously-skip-permissions');expect(args).not.toContain('--auto-approve');expect(args).not.toContain('Bash');expect(args).not.toContain('bash')}
 });
 test('keeps the prompt in an argument of its own',()=>expect(cliArguments('claude','$(touch /tmp/injected)',2)[1]).toBe('$(touch /tmp/injected)'));
 test('rejects paths passed in place of identifiers',()=>{expect(()=>safeId('../../secret')).toThrow();expect(safeName('../../contract.txt')).toBe('contract.txt');expect(safeName('C:\\secret\\contract.txt')).toBe('contract.txt')});
});
