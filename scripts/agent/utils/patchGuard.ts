import { changedLinesAgainst } from './git';


export function assertPatchWithin(limit: number) {
const { total, added, removed } = changedLinesAgainst();
if (total > limit) {
throw new Error(`Patch too large: ${total} lines (added ${added}, removed ${removed}) > limit ${limit}`);
}
}