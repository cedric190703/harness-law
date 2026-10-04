import { expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function exercise(failCli: boolean) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'saul-repair-'));
  const executable = (name: string, code: string) => {
    const file = path.join(temp, name);
    fs.writeFileSync(file, `#!${process.execPath}\n${code}`, { mode: 0o700 });
    return file;
  };
  try {
    const python = executable('python-stub', `
import fs from 'node:fs';
const [script, mode] = process.argv.slice(2);
if (script.endsWith('extract_text.py')) {
  fs.mkdirSync('text', { recursive: true });
  for (const file of fs.readdirSync('documents')) fs.copyFileSync('documents/'+file, 'text/'+file+'.txt');
} else if (mode === 'ledger') {
  console.log('Missing ledger.jsonl: write the required output files.');
  process.exit(1);
}
`);
    const cli = executable('provider-stub', failCli
      ? `console.error('Authentication refused'); process.exit(17);`
      : `console.log(JSON.stringify({role:'assistant',content:'Here is a report in chat, without files.'}));`);
    const runner = path.join(temp, 'run.ts');
    fs.writeFileSync(runner, `
import fs from 'node:fs';
import path from 'node:path';
import { createProject, addDocuments, startRun, getProject, runDir } from ${JSON.stringify(path.resolve('src/lib/harness/engine.ts'))};
const project = createProject('Synthetic repair test');
addDocuments(project.id, [{name:'reference.txt',data:Buffer.from('Amount: 100 euros.')}]);
const run = startRun(project.id, 'Compare the synthetic amount.', 'vibe', 2);
let current;
for (let i = 0; i < 1000; i++) {
  current = getProject(project.id).runs[0];
  if (!['queued','running','checking'].includes(current.status)) break;
  await Bun.sleep(10);
}
const dir = runDir(project.id, run.id);
console.log(JSON.stringify({status:current.status,attempt:current.attempt,error:current.error,artifacts:current.artifacts,dir,prompt:fs.readFileSync(path.join(dir,'prompt-1.txt'),'utf8'),repair:fs.existsSync(path.join(dir,'prompt-2.txt'))?fs.readFileSync(path.join(dir,'prompt-2.txt'),'utf8'):null}));
`);
    const result = spawnSync(process.execPath, [runner], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 15_000,
      env: { ...process.env, LEGAL_DATA_DIR: path.join(temp, 'data'), LEGAL_PYTHON: python, LEGAL_VIBE_BIN: cli },
    });
    expect(result.status).toBe(0);
    return JSON.parse(result.stdout.trim());
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

test('missing output files receive one repair pass, then remain blocked without exports', () => {
  const result = exercise(false);
  expect(result.status).toBe('blocked');
  expect(result.attempt).toBe(2);
  expect(result.artifacts).toEqual([]);
  expect(result.repair).toContain('Missing ledger.jsonl');
  expect(result.prompt).toContain(path.join(result.dir, 'skills/cross-document-review/SKILL.md'));
  expect(result.prompt).toContain(path.join(result.dir, 'ledger.jsonl'));
  expect(result.prompt).toContain('printing JSON in chat does not create a file');
}, 20_000);

test('a CLI authentication failure stays fatal and is not retried', () => {
  const result = exercise(true);
  expect(result.status).toBe('failed');
  expect(result.attempt).toBe(1);
  expect(result.repair).toBeNull();
  expect(result.error).toContain('Authentication refused');
  expect(result.artifacts).toEqual([]);
}, 20_000);
