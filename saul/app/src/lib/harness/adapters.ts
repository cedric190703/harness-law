import type { Provider } from './types';
type Json = Record<string, unknown>;
export interface Observation { kind: 'assistant' | 'tool' | 'error'; text: string; tool?: string; toolId?: string; input?: Json }
function object(value: unknown): Json { return value && typeof value === 'object' ? value as Json : {}; }
function text(value: unknown): string { return typeof value === 'string' ? value : JSON.stringify(value ?? ''); }
export function normalizeEvent(value: unknown): Observation[] {
  const e=object(value), message=object(e.message ?? e);
  const out: Observation[]=[];
  if(e.type==='effect') {
    const detail=object(e.detail), state=object(e.state), rawInput=object(detail.input);
    const input:Json={...rawInput,...(rawInput.filePath?{file_path:rawInput.filePath}:{})};
    out.push({kind:'tool',tool:text(detail.toolName||detail.tool_name||e.title),toolId:text(e.id),input,text:`${text(detail.toolName||detail.tool_name||e.title)} · ${text(input.path??input.file_path??'')}`});
    if(['completed','failed','cancelled','skipped'].includes(text(state.status))) out.push({kind:state.status==='completed'?'tool':'error',toolId:text(e.id),text:text(state.outputText||state.output_text||state.output||state.error||state.reason||state.display)});
  }
  if(e.type==='result' && e.is_error) out.push({kind:'error',text: text(e.result ?? e.errors ?? 'The CLI failed')});
  if(message.role==='assistant') {
    if(typeof message.content==='string' && message.content) out.push({kind:'assistant',text:message.content});
    if(Array.isArray(message.content)) for(const raw of message.content) {
      const c=object(raw);
      if(c.type==='text' && c.text) out.push({kind:'assistant',text:text(c.text)});
      if(c.type==='tool_use') out.push({kind:'tool',tool:text(c.name),toolId:text(c.id),input:object(c.input),text:`${text(c.name)} · ${text(object(c.input).file_path ?? object(c.input).path ?? object(c.input).pattern ?? '')}`});
      // Thinking blocks and signatures are neither exposed nor persisted.
    }
    if(Array.isArray(message.tool_calls)) for(const raw of message.tool_calls) {
      const call=object(raw), fn=object(call.function); let input=object(fn.arguments);
      if(typeof fn.arguments==='string'){try{input=JSON.parse(fn.arguments)}catch{input={}}}
      out.push({kind:'tool',tool:text(fn.name),toolId:text(call.id),input,text:`${text(fn.name)} · ${text(input.path ?? input.file_path ?? input.pattern ?? '')}`});
    }
  }
  if(message.role==='tool') out.push({kind:'tool',toolId:text(message.tool_call_id),text:text(message.content)});
  if(message.role==='user' && Array.isArray(message.content)) for(const raw of message.content) {
    const c=object(raw); if(c.type==='tool_result') out.push({kind:c.is_error?'error':'tool',toolId:text(c.tool_use_id),text:text(c.content)});
  }
  return out;
}
export function cliArguments(provider: Provider, prompt: string, budget: number): string[] {
  if(provider==='claude') return ['-p',prompt,'--output-format','stream-json','--verbose','--restricted','--permission-mode','acceptEdits','--permission-prompts','none','--tools','Read,Write,Edit,Glob,Grep','--allowedTools','Read,Write,Edit,Glob,Grep','--strict-mcp-config','--setting-sources','','--max-budget-usd',String(budget)];
  return ['-p',prompt,'--output','streaming','--agent','accept-edits','--trust','--max-turns','30','--max-price',String(budget),...['read_file','write_file','edit','grep'].flatMap(t=>['--enabled-tools',t])];
}
