import fs from 'node:fs';
import path from 'node:path';


export const ensureDir = (p: string) => fs.mkdirSync(p, { recursive: true });
export const writeJSON = (p: string, v: unknown) => {
ensureDir(path.dirname(p));
fs.writeFileSync(p, JSON.stringify(v, null, 2));
};
export const readText = (p: string) => fs.readFileSync(p, 'utf8');
export const fileExists = (p: string) => fs.existsSync(p);