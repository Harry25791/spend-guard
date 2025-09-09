import crypto from 'node:crypto';
import fs from 'node:fs';
import fg from 'fast-glob';
import { writeJSON } from '../utils/fsx';
import type { ContextPack, ContextDoc } from '../types';


const SRC = JSON.parse(fs.readFileSync('.agent/context-sources.json', 'utf8')) as { include: string[]; exclude?: string[] };


function sha1(buf: Buffer) { return crypto.createHash('sha1').update(buf).digest('hex'); }


async function build() {
const matches = await fg(SRC.include, { ignore: SRC.exclude, dot: true, onlyFiles: true });
const docs: ContextDoc[] = matches.map(p => {
const buf = fs.readFileSync(p);
return { path: p, bytes: buf.length, sha1: sha1(buf) };
});
const pack: ContextPack = { generatedAt: new Date().toISOString(), sources: docs };
writeJSON('.agent/context.json', pack);
console.log(`Context: ${docs.length} files, ${(docs.reduce((n,d)=>n+d.bytes,0)/1024).toFixed(1)} KB → .agent/context.json`);
}


build().catch(e => { console.error(e); process.exit(1); });