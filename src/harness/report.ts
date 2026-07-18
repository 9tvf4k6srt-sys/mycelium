import { stableStringify } from '../core/hash.js';
import type { CompareReport } from './compare.js';
import type { RunSummary } from './runner.js';

const HONESTY_NOTE =
  'honesty: deterministic stand-in solvers on fixture tasks. This measures the memory ' +
  'mechanism (retrieval cutting turns), not LLM coding ability.';

const hash12 = (h: string): string => `${h.slice(0, 12)}…`;
const f2 = (x: number): string => x.toFixed(2);
const f3 = (x: number): string => x.toFixed(3);
const signedInt = (x: number): string => (x > 0 ? `+${x}` : String(x));
const signed = (x: number, digits: number): string => (x >= 0 ? '+' : '') + x.toFixed(digits);
const wilson = (s: RunSummary): string => `[${f3(s.wilson95[0])}, ${f3(s.wilson95[1])}]`;

/** Render one run summary as a markdown table with the honesty note attached. */
export function summaryToMarkdown(s: RunSummary): string {
  const rows: Array<[string, string]> = [
    ['seed', String(s.seed)],
    ['corpusHash', hash12(s.corpusHash)],
    ['tasks', String(s.tasks)],
    ['attempts', String(s.attempts)],
    ['solved', String(s.solved)],
    ['failed', String(s.failed)],
    ['totalTurns', String(s.totalTurns)],
    ['meanTurns', f2(s.meanTurns)],
    ['solveRate', f3(s.solveRate)],
    ['wilson95', wilson(s)],
    ['eventHash', hash12(s.eventHash)],
  ];
  return [
    `## run summary: ${s.agent}`,
    '',
    '| metric | value |',
    '| --- | ---: |',
    ...rows.map(([k, v]) => `| ${k} | ${v} |`),
    '',
    `> ${HONESTY_NOTE}`,
  ].join('\n');
}

/** Render an A/B comparison: baseline vs treatment with deltas and the fairness notes. */
export function compareToMarkdown(c: CompareReport): string {
  const b = c.baseline;
  const t = c.treatment;
  return [
    `## A/B: ${b.agent} (baseline) vs ${t.agent} (treatment)`,
    '',
    '| metric | baseline | treatment | delta |',
    '| --- | ---: | ---: | ---: |',
    `| attempts | ${b.attempts} | ${t.attempts} | ${signedInt(t.attempts - b.attempts)} |`,
    `| solved | ${b.solved} | ${t.solved} | ${signedInt(t.solved - b.solved)} |`,
    `| failed | ${b.failed} | ${t.failed} | ${signedInt(t.failed - b.failed)} |`,
    `| totalTurns | ${b.totalTurns} | ${t.totalTurns} | ${signedInt(t.totalTurns - b.totalTurns)} |`,
    `| meanTurns | ${f2(b.meanTurns)} | ${f2(t.meanTurns)} | ${signed(c.meanTurnsDelta, 2)} |`,
    `| solveRate | ${f3(b.solveRate)} | ${f3(t.solveRate)} | ${signed(c.solveRateDelta, 3)} |`,
    `| wilson95 | ${wilson(b)} | ${wilson(t)} | — |`,
    '',
    'notes:',
    ...c.notes.map((n) => `- ${n}`),
    '',
    `> ${HONESTY_NOTE}`,
  ].join('\n');
}

/** Canonical JSON plus a trailing newline, for machine consumption. */
export function toJson(x: unknown): string {
  return `${stableStringify(x)}\n`;
}
