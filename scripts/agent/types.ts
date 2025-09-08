export type ContextDoc = { path: string; bytes: number; sha1: string };
export type ContextPack = { generatedAt: string; sources: ContextDoc[] };
export type PlanStep = {
id: string;
title: string;
rationale: string;
changeBudget: number; // max lines for this step
acceptance: string[]; // Given/When/Then bullets
touches: string[]; // glob hints
};
export type Plan = { chosen: PlanStep; alternatives: PlanStep[] };