import { describe, it, expect } from 'vitest';
import fs from 'node:fs';


describe('context pack', () => {
it('exists and is JSON', () => {
const raw = fs.readFileSync('.agent/context.json', 'utf8');
const obj = JSON.parse(raw);
expect(obj).toHaveProperty('generatedAt');
expect(Array.isArray(obj.sources)).toBe(true);
});
});