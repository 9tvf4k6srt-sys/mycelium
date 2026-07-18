import { readFileSync } from 'node:fs';
import { compareCorpus, runDemo } from '../examples/demo.js';
import type { MyceliumEvent } from './core/events.js';
import { Journal } from './core/journal.js';
import { healthReport } from './telemetry/scoring.js';

const HELP = `mycelium — eval-harness-first agent memory loop

usage:
  mycelium demo
      run the deterministic A/B demo on fixtures/tasks (seed 42, repeatEach 2)
  mycelium eval --corpus <dir> [--seed <n>] [--repeat <n>]
      A/B fixed-order vs memory-first on a task corpus (defaults: seed 42, repeat 2)
  mycelium health --journal <file.jsonl>
      score subsystem health from a journal (heartbeats never count as execution)
  mycelium --help
      show this text
`;

function flagValue(args: readonly string[], name: string): string | undefined {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
}

function intFlag(args: readonly string[], name: string, fallback: number): number {
  const raw = flagValue(args, name);
  const n = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function runEval(args: readonly string[]): number {
  const corpus = flagValue(args, '--corpus');
  if (corpus === undefined) {
    process.stderr.write('eval: missing required --corpus <dir>\n');
    return 1;
  }
  try {
    const { markdown } = compareCorpus(corpus, intFlag(args, '--seed', 42), intFlag(args, '--repeat', 2));
    process.stdout.write(`${markdown}\n`);
    return 0;
  } catch (cause) {
    process.stderr.write(`eval failed: ${message(cause)}\n`);
    return 1;
  }
}

/** System names come from the events themselves: anything that executed or heartbeated. */
function systemsOf(events: readonly MyceliumEvent[]): string[] {
  const names = new Set<string>();
  for (const e of events) {
    if (e.type === 'system_executed' || e.type === 'heartbeat') {
      names.add(e.system);
    }
  }
  return [...names].sort();
}

function runHealth(args: readonly string[]): number {
  const file = flagValue(args, '--journal');
  if (file === undefined) {
    process.stderr.write('health: missing required --journal <file.jsonl>\n');
    return 1;
  }
  let journal: Journal;
  try {
    journal = Journal.fromJSONL(readFileSync(file, 'utf8'));
  } catch (cause) {
    process.stderr.write(`health: cannot read journal: ${message(cause)}\n`);
    return 1;
  }
  const events = journal.all();
  const systems = systemsOf(events);
  if (systems.length === 0) {
    process.stdout.write('no system_executed or heartbeat events in journal; nothing to score\n');
    return 0;
  }
  const report = healthReport(systems, events, Date.now());
  const lines = [
    `health report (generated ${new Date(report.generatedAt).toISOString()})`,
    `composite: ${report.composite}/100 (grade ${report.grade})`,
    'subsystems:',
    ...report.subsystems.map((s) => {
      const age = s.ageDays === null ? 'never executed' : `${s.ageDays.toFixed(1)}d since last real run`;
      const penalties = s.penalties.length === 0 ? '' : `; penalties: ${s.penalties.join('; ')}`;
      return `  ${s.name}: ${s.score} ${s.status} (${age}${penalties})`;
    }),
    report.honestyNotes.length === 0 ? 'honesty notes: none' : 'honesty notes:',
    ...report.honestyNotes.map((n) => `  - ${n}`),
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

/** Entry point. Thin wrapper over harness/telemetry; returns the exit code. */
export function main(argv: readonly string[]): number {
  const [command, ...rest] = argv;
  switch (command) {
    case 'demo':
      try {
        process.stdout.write(`${runDemo().output}\n`);
        return 0;
      } catch (cause) {
        process.stderr.write(`demo failed: ${message(cause)}\n`);
        return 1;
      }
    case 'eval':
      return runEval(rest);
    case 'health':
      return runHealth(rest);
    case '--help':
    case '-h':
    case 'help':
    case undefined:
      process.stdout.write(HELP);
      return 0;
    default:
      process.stderr.write(`unknown command: ${String(command)}\n\n${HELP}`);
      return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
