// scripts/agent/ops/apply-ops.ts
import fs from "node:fs";
import path from "node:path";

export type InsertAfter = {
  op: "insertAfter";
  file: string;
  anchor: string;
  text: string;
};

export type ReplaceBlock = {
  op: "replaceBlock";
  file: string;
  begin: string;
  end: string;
  text: string;
};

export type AddImport = {
  op: "addImport";
  file: string;
  spec: {
    from: string;
    names?: string[];
    default?: string;
    typeOnly?: boolean;
  };
};

export type AddTest = {
  op: "addTest";
  file: string;
  text: string;
};

export type Op = InsertAfter | ReplaceBlock | AddImport | AddTest;

export type OpsPlan = {
  id: string;
  acceptance?: string[];
  ops: Op[];
};

function ensureParentDir(p: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function detectEOL(s: string): "\n" | "\r\n" {
  return s.includes("\r\n") ? "\r\n" : "\n";
}

function insertAfter(file: string, anchor: string, text: string) {
  const raw = fs.readFileSync(file, "utf8");
  if (raw.includes(text)) return;
  const idx = raw.indexOf(anchor);
  if (idx < 0) throw new Error(`anchor not found in ${file}: ${anchor}`);
  const eol = detectEOL(raw);
  const pos = idx + anchor.length;
  const next = raw.slice(0, pos) + eol + text + eol + raw.slice(pos);
  fs.writeFileSync(file, next);
}

function replaceBlock(file: string, begin: string, end: string, text: string) {
  const raw = fs.readFileSync(file, "utf8");
  const i = raw.indexOf(begin);
  const j = raw.indexOf(end, i >= 0 ? i + begin.length : 0);
  if (i < 0 || j < 0) throw new Error(`begin/end not found in ${file}`);
  const eol = detectEOL(raw);
  const before = raw.slice(0, i + begin.length);
  const after = raw.slice(j);
  const body = text.endsWith(eol) ? text : text + eol;
  const next = before + eol + body + after;
  if (next === raw) return;
  fs.writeFileSync(file, next);
}

function addImport(file: string, spec: AddImport["spec"]) {
  const raw = fs.readFileSync(file, "utf8");
  const eol = detectEOL(raw);
  const names = spec.names && spec.names.length ? `{ ${spec.names.join(", ")} }` : "";
  const def = spec.default ?? "";
  const combined = def && names ? `${def}, ${names}` : def || names;
  const typePrefix = spec.typeOnly ? "type " : "";
  const imp = `import ${typePrefix}${combined} from "${spec.from}";`;
  if (raw.includes(imp)) return;

  const lines = raw.split(eol);
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\b/.test(lines[i])) lastImport = i;
  }
  const insertAt = lastImport >= 0 ? lastImport + 1 : 0;
  lines.splice(insertAt, 0, imp);
  fs.writeFileSync(file, lines.join(eol));
}

function addTest(file: string, text: string) {
  ensureParentDir(file);
  if (fs.existsSync(file)) {
    const existing = fs.readFileSync(file, "utf8");
    if (existing === text) return;
  }
  fs.writeFileSync(file, text);
}

export function applyOps(planPath = ".agent/ops.json"): { applied: number } {
  if (!fs.existsSync(planPath)) {
    throw new Error(`ops plan not found: ${planPath}`);
  }
  const raw = fs.readFileSync(planPath, "utf8");
  const plan = JSON.parse(raw) as unknown as OpsPlan;
  if (!plan || !Array.isArray(plan.ops)) throw new Error("invalid ops plan");

  let applied = 0;
  for (const op of plan.ops) {
    switch (op.op) {
      case "insertAfter":
        ensureParentDir(op.file);
        insertAfter(op.file, op.anchor, op.text);
        applied++;
        break;
      case "replaceBlock":
        ensureParentDir(op.file);
        replaceBlock(op.file, op.begin, op.end, op.text);
        applied++;
        break;
      case "addImport":
        ensureParentDir(op.file);
        addImport(op.file, op.spec);
        applied++;
        break;
      case "addTest":
        ensureParentDir(op.file);
        addTest(op.file, op.text);
        applied++;
        break;
      default: {
        const _never: never = op;
        throw new Error(`unsupported op: ${JSON.stringify(_never)}`);
      }
    }
  }
  return { applied };
}

// ─────────────────────────────────────────────────────────────────────────────
// Type guards (append-only): shared contract for generator & validator
// ─────────────────────────────────────────────────────────────────────────────

function isRecord(v: any): v is Record<string, unknown> {
  return v !== null && typeof v === "object";
}

export function isOp(value: any): value is Op {
  if (!isRecord(value)) return false;
  if (typeof (value as any).op !== "string") return false;

  const op = (value as any).op as Op["op"];
  const allowed = new Set<Op["op"]>(["insertAfter", "replaceBlock", "addImport", "addTest"]);
  if (!allowed.has(op)) return false;

  if (op === "insertAfter") {
    return typeof (value as any).file === "string"
      && typeof (value as any).anchor === "string"
      && typeof (value as any).text === "string";
  }

  if (op === "replaceBlock") {
    return typeof (value as any).file === "string"
      && typeof (value as any).begin === "string"
      && typeof (value as any).end === "string"
      && typeof (value as any).text === "string";
  }

  if (op === "addImport") {
    const spec = (value as any).spec;
    if (!isRecord(spec)) return false;
    if (typeof (spec as any).from !== "string") return false;
    if ("names" in spec && (spec as any).names !== undefined) {
      if (!Array.isArray((spec as any).names)) return false;
      if (!(spec as any).names.every((n: any) => typeof n === "string")) return false;
    }
    if ("default" in spec && (spec as any).default !== undefined) {
      if (typeof (spec as any).default !== "string") return false;
    }
    if ("typeOnly" in spec && (spec as any).typeOnly !== undefined) {
      if (typeof (spec as any).typeOnly !== "boolean") return false;
    }
    return typeof (value as any).file === "string";
  }

  if (op === "addTest") {
    return typeof (value as any).file === "string"
      && typeof (value as any).text === "string";
  }

  return false;
}

export function isOpsPlan(value: any): value is OpsPlan {
  if (!isRecord(value)) return false;
  if (typeof (value as any).id !== "string") return false;
  if (!Array.isArray((value as any).ops)) return false;
  if (!((value as any).ops as any[]).every(isOp)) return false;

  if ("acceptance" in value && (value as any).acceptance !== undefined) {
    if (!Array.isArray((value as any).acceptance)) return false;
    if (!(value as any).acceptance.every((s: any) => typeof s === "string")) return false;
  }
  return true;
}
