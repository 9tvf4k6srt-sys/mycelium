import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { contentHash } from '../core/hash.js';
import { type TaskId, asTaskId } from '../core/ids.js';
import { type Result, err, ok } from '../core/result.js';
import { normalizeSignature } from '../memory/signature.js';

/** A find→replace edit against one file in the fixture. Exactly one candidate per task passes the checks. */
export interface CandidateFix {
  /** File to edit, relative to the task fixture dir. */
  file: string;
  /** Exact substring to find. */
  find: string;
  /** Replacement for the first occurrence of {@link CandidateFix.find}. */
  replace: string;
}

/** A ground-truth check executed in the attempt workDir (shell:false); exit code 0 = pass. */
export interface Check {
  /** Command line, split on whitespace and run via execFileSync (e.g. "node check.cjs"). */
  cmd: string;
  /** Per-execution timeout. Default 10_000. */
  timeoutMs?: number;
}

/** A versioned fixture task: the harness's external ground truth (ADR-0001). */
export interface Task {
  id: TaskId;
  title: string;
  area: string;
  /** Absolute path of the loaded fixture directory. Excluded from {@link corpusHash}. */
  fixtureDir: string;
  /** Breakage signature, normalized at load via memory/signature. */
  signature: string;
  description: string;
  candidates: CandidateFix[];
  checks: Check[];
}

const DEFAULT_CHECK_TIMEOUT_MS = 10_000;

function causeMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function asNonEmptyString(x: unknown): string | null {
  return typeof x === 'string' && x.length > 0 ? x : null;
}

function parseCandidate(x: unknown): CandidateFix | null {
  if (!isRecord(x)) {
    return null;
  }
  const file = asNonEmptyString(x.file);
  const find = asNonEmptyString(x.find);
  const replace = typeof x.replace === 'string' ? x.replace : null;
  if (file === null || find === null || replace === null) {
    return null;
  }
  return { file, find, replace };
}

function parseCheck(x: unknown): Check | null {
  if (!isRecord(x)) {
    return null;
  }
  const cmd = asNonEmptyString(x.cmd);
  if (cmd === null) {
    return null;
  }
  const check: Check = { cmd };
  if (x.timeoutMs !== undefined) {
    if (typeof x.timeoutMs !== 'number' || x.timeoutMs <= 0) {
      return null;
    }
    check.timeoutMs = x.timeoutMs;
  }
  return check;
}

/**
 * Load one fixture task from a directory containing task.json.
 * The manifest's `signature` is raw text; it is normalized here, so every
 * consumer downstream sees canonical signatures.
 */
export function loadTask(dir: string): Result<Task, Error> {
  const manifestPath = join(dir, 'task.json');
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (cause) {
    return err(new Error(`loadTask: cannot read ${manifestPath}: ${causeMessage(cause)}`));
  }
  if (!isRecord(parsed)) {
    return err(new Error(`loadTask: ${manifestPath} must contain a JSON object`));
  }
  const id = asNonEmptyString(parsed.id);
  const title = asNonEmptyString(parsed.title);
  const area = asNonEmptyString(parsed.area);
  const signature = asNonEmptyString(parsed.signature);
  const description = typeof parsed.description === 'string' ? parsed.description : '';
  if (id === null || title === null || area === null || signature === null) {
    return err(new Error(`loadTask: ${manifestPath} requires non-empty id, title, area, signature`));
  }
  if (!Array.isArray(parsed.candidates) || parsed.candidates.length === 0) {
    return err(new Error(`loadTask: ${manifestPath} requires a non-empty candidates array`));
  }
  const candidates: CandidateFix[] = [];
  for (const raw of parsed.candidates) {
    const candidate = parseCandidate(raw);
    if (candidate === null) {
      return err(new Error(`loadTask: ${manifestPath} has a malformed candidate (file/find/replace)`));
    }
    candidates.push(candidate);
  }
  if (!Array.isArray(parsed.checks) || parsed.checks.length === 0) {
    return err(new Error(`loadTask: ${manifestPath} requires a non-empty checks array`));
  }
  const checks: Check[] = [];
  for (const raw of parsed.checks) {
    const check = parseCheck(raw);
    if (check === null) {
      return err(new Error(`loadTask: ${manifestPath} has a malformed check (cmd, optional timeoutMs)`));
    }
    checks.push(check);
  }
  return ok({
    id: asTaskId(id),
    title,
    area,
    fixtureDir: resolve(dir),
    signature: normalizeSignature(signature),
    description,
    candidates,
    checks,
  });
}

/**
 * Load every task directory under root, sorted by id (deterministic order).
 * Invariant: any malformed task fails the whole corpus — a corpus that cannot
 * be fully verified is not ground truth.
 */
export function loadCorpus(root: string): Result<Task[], Error> {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch (cause) {
    return err(new Error(`loadCorpus: cannot read ${root}: ${causeMessage(cause)}`));
  }
  const tasks: Task[] = [];
  for (const entry of entries) {
    const dir = join(root, entry);
    try {
      if (!statSync(dir).isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }
    const loaded = loadTask(dir);
    if (!loaded.ok) {
      return err(loaded.error);
    }
    tasks.push(loaded.value);
  }
  tasks.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return ok(tasks);
}

/**
 * Content hash of the corpus's verification-relevant fields.
 * Invariant: fixtureDir is excluded — the hash must not depend on where the
 * repo is checked out. Candidate order is included (order costs turns).
 */
export function corpusHash(tasks: readonly Task[]): string {
  return contentHash(
    tasks.map((t) => ({
      id: t.id,
      title: t.title,
      area: t.area,
      signature: t.signature,
      description: t.description,
      candidates: t.candidates,
      checks: t.checks,
    })),
  );
}

/**
 * Execute one check in workDir via execFileSync with shell:false
 * ("node check.cjs" becomes argv ["node", "check.cjs"]). True on exit 0.
 * Never throws: nonzero exit, timeout, and spawn error all mean "fail".
 */
export function runCheck(check: Check, workDir: string): boolean {
  const [bin, ...args] = check.cmd
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (bin === undefined) {
    return false;
  }
  try {
    execFileSync(bin, args, {
      cwd: workDir,
      timeout: check.timeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

/** Run every check in order; all must pass. Stops at the first failure. */
export function runTaskChecks(checks: readonly Check[], workDir: string): boolean {
  for (const check of checks) {
    if (!runCheck(check, workDir)) {
      return false;
    }
  }
  return true;
}
