import { describe, expect, test } from 'bun:test';
import { normalizeEvent, cliArguments } from './adapters';
import { ancestors, visibleTraceNodes, parseLedger, safeId, safeName, validateDeliverable } from './provenance';
import type { LedgerRow, TraceNode } from './types';
const ledger:LedgerRow[]=[{id:'R-1',topic:'Préavis',status:'deviation'},{id:'R-2',topic:'Droit applicable',status:'match'}];
const valid={title:'Rapport',kind:'report',sections:[{id:'preavis',title:'Préavis',content:'30 jours au lieu de 60.',ledgerIds:['R-1']}]};
describe('Contrat de sortie du harness',()=>{
 test('accepte des sections reliées aux constats existants',()=>expect(validateDeliverable(valid,ledger).sections).toHaveLength(1));
 test('refuse une section sans provenance',()=>expect(()=>validateDeliverable({...valid,sections:[{...valid.sections[0],ledgerIds:[]}]},ledger)).toThrow());
 test('refuse un ID de constat inventé',()=>expect(()=>validateDeliverable({...valid,sections:[{...valid.sections[0],ledgerIds:['R-99']}]},ledger)).toThrow());
 test('refuse un écart absent du livrable',()=>expect(()=>validateDeliverable({...valid,sections:[{...valid.sections[0],ledgerIds:['R-2']}]},ledger)).toThrow('absents'));
 test('refuse IDs dupliqués et tableaux irréguliers',()=>{
   expect(()=>validateDeliverable({...valid,sections:[valid.sections[0],valid.sections[0]]},ledger)).toThrow();
   expect(()=>validateDeliverable({...valid,sections:[{...valid.sections[0],table:{headers:['A','B'],rows:[['C']]}}]},ledger)).toThrow();
 });
 test('inclut les incertitudes et allégations fausses dans le contrôle de couverture',()=>{
   expect(()=>validateDeliverable(valid,[...ledger,{id:'R-3',topic:'Litige',status:'unclear'}])).toThrow();
   expect(()=>validateDeliverable(valid,[...ledger,{id:'R-3',topic:'Déclaration',status:'claim',verdict:'inaccurate'}])).toThrow();
 });
 test('ne masque pas une ligne JSON corrompue',()=>expect(()=>parseLedger('{"id":"R-1","topic":"A"}\n{')).toThrow());
 test('refuse le registre vide et les IDs répétés',()=>{expect(()=>parseLedger('')).toThrow();expect(()=>parseLedger('{"id":"R-1","topic":"A"}\n{"id":"R-1","topic":"B"}')).toThrow()});
});
describe('Provenance ciblée',()=>{
 const n=(id:string,parents:string[]):TraceNode=>({id,parents,kind:'finding',label:id,detail:'',status:'passed'});
 const nodes=[n('input',[]),n('doc-a',['input']),n('doc-b',['input']),n('finding-a',['doc-a']),n('finding-b',['doc-b']),n('section-a',['finding-a']),n('section-b',['finding-b'])];
 test('un clic sur la section A exclut les pièces, constats et section B',()=>expect([...ancestors(nodes,'section-a')]).toEqual(['section-a','finding-a','doc-a','input']));
 test('tolère les cycles et références manquantes sans boucle',()=>expect([...ancestors([n('a',['b','missing']),n('b',['a'])],'a')]).toEqual(['a','b']));
 const traced:TraceNode[]=[{...n('input',[]),kind:'input'},{...n('skill',['input']),kind:'skill'},{...n('tool',['skill']),kind:'tool'},n('proof',['tool']),{...n('section',['proof','skill']),kind:'section'}];
 test('la vue section masque les étapes communes et permet de les réafficher',()=>{
   expect(visibleTraceNodes(traced,'section').map(n=>n.id)).toEqual(['proof','section']);
   expect(visibleTraceNodes(traced,'section',true,true)).toHaveLength(5);
 });
 test('un clic sur une étape du skill conserve cette étape et ses ancêtres',()=>expect(visibleTraceNodes(traced,'skill').map(n=>n.id)).toEqual(['input','skill']));
 test('un outil sélectionné reste visible même avec les autres outils masqués',()=>expect(visibleTraceNodes(traced,'tool').map(n=>n.id)).toEqual(['input','skill','tool']));
});
describe('Adaptateurs CLI et confidentialité',()=>{
 test('ne conserve aucun bloc de raisonnement interne Claude',()=>expect(normalizeEvent({type:'assistant',message:{role:'assistant',content:[{type:'thinking',thinking:'secret'},{type:'text',text:'Je compare les clauses.'}]}})).toEqual([{kind:'assistant',text:'Je compare les clauses.'}]));
 test('ne conserve aucune entrée reasoning Vibe',()=>expect(normalizeEvent({type:'reasoning',text:'secret',summary:['secret']})).toEqual([]));
 test('normalise appel et résultat Claude avec un ID commun',()=>{
  const call=normalizeEvent({type:'assistant',message:{role:'assistant',content:[{type:'tool_use',id:'t1',name:'Read',input:{file_path:'text/a.txt'}}]}})[0];
  const result=normalizeEvent({type:'user',message:{role:'user',content:[{type:'tool_result',tool_use_id:'t1',content:'Citation'}]}})[0];
  expect(call.toolId).toBe(result.toolId);expect(call.input?.file_path).toBe('text/a.txt');
 });
 test('normalise les effets du protocole public Vibe en camelCase',()=>{
   const [call,result]=normalizeEvent({type:'effect',id:'v1',title:'Read',detail:{toolName:'read_file',input:{filePath:'text/source.txt'}},state:{status:'completed',outputText:'texte'}});
   expect(call.tool).toBe('read_file');expect(call.input?.file_path).toBe('text/source.txt');expect(result.text).toBe('texte');
 });
 test('n’accorde ni shell ni contournement global des permissions',()=>{
  for(const provider of ['claude','vibe'] as const){const args=cliArguments(provider,'prompt',2);expect(args).not.toContain('--dangerously-skip-permissions');expect(args).not.toContain('--auto-approve');expect(args).not.toContain('Bash');expect(args).not.toContain('bash')}
 });
 test('garde le prompt dans un argument indépendant',()=>expect(cliArguments('claude','$(touch /tmp/injected)',2)[1]).toBe('$(touch /tmp/injected)'));
 test('rejette les chemins transmis à la place des identifiants',()=>{expect(()=>safeId('../../secret')).toThrow();expect(safeName('../../contrat.txt')).toBe('contrat.txt');expect(safeName('C:\\secret\\contrat.txt')).toBe('contrat.txt')});
});
