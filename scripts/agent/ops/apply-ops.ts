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
  const planUnknown: unknown = JSON.parse(raw);
  if (!isOpsPlan(planUnknown)) throw new Error("invalid ops plan");
  const plan = planUnknown; // narrowed by guard

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
        const neverOp: never = op;
        throw new Error(`unsupported op: ${JSON.stringify(neverOp)}`);
      }
    }
  }
  return { applied };
}

// ─────────────────────────────────────────────────────────────────────────────
// Type guards (no unnecessary assertions)
// ─────────────────────────────────────────────────────────────────────────────
function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object";
}
function hasString(v: Record<string, unknown>, key: string): v is Record<string, string> {
  return typeof v[key] === "string";
}
function hasBooleanFlag(v: Record<string, unknown>, key: string): boolean {
  return typeof v[key] === "boolean";
}

export function isOp(value: unknown): value is Op {
  if (!isRecord(value)) return false;
  const v = value as Record<string, unknown>;

  if (!hasString(v, "op")) return false;
  const opVal = v.op;

  if (opVal !== "insertAfter" && opVal !== "replaceBlock" && opVal !== "addImport" && opVal !== "addTest") {
    return false;
  }
  if (!hasString(v, "file")) return false;

  if (opVal === "insertAfter") {
    return hasString(v, "anchor") && hasString(v, "text");
  }

  if (opVal === "replaceBlock") {
    return hasString(v, "begin") && hasString(v, "end") && hasString(v, "text");
  }

  if (opVal === "addImport") {
    const specUnknown = v["spec"];
    if (!isRecord(specUnknown)) return false;
    const s = specUnknown as Record<string, unknown>;
    if (!hasString(s, "from")) return false;

    if ("names" in s && s.names !== undefined) {
      if (!Array.isArray(s.names) || !s.names.every((n) => typeof n === "string")) return false;
    }
    if ("default" in s && s.default !== undefined) {
      if (typeof s.default !== "string") return false;
    }
    if ("typeOnly" in s && s.typeOnly !== undefined) {
      if (!hasBooleanFlag(s, "typeOnly")) return false;
    }
    return true;
  }

  if (opVal === "addTest") {
    return hasString(v, "text");
  }

  return false;
}

export function isOpsPlan(value: unknown): value is OpsPlan {
  if (!isRecord(value)) return false;
  const v = value as Record<string, unknown>;

  if (!hasString(v, "id")) return false;

  const ops = v["ops"];
  if (!Array.isArray(ops)) return false;
  if (!ops.every((o) => isOp(o))) return false;

  if ("acceptance" in v && v.acceptance !== undefined) {
    if (!Array.isArray(v.acceptance) || !v.acceptance.every((s) => typeof s === "string")) {
      return false;
    }
  }
  return true;
}
