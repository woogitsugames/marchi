// Loads shrunk fuzz cases from tests/regressions/*.json.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FailureKind, RunOptions, Scenario } from '../../tools/fuzz-lib';

export interface Regression {
  name: string;
  /** 'known-failing': reproduces an open bug (run by `npm run test:known-failing`); 'fixed': must pass in `npm test`. */
  status: 'known-failing' | 'fixed';
  /** Failure kind the case reproduces while the bug is open. */
  expect: FailureKind;
  review?: string;
  note: string;
  options?: RunOptions;
  scenario: Scenario;
  file: string;
}

const here = dirname(fileURLToPath(import.meta.url));

export function loadRegressions(): Regression[] {
  return readdirSync(here).filter((f) => f.endsWith('.json')).sort()
    .map((f) => ({ ...(JSON.parse(readFileSync(join(here, f), 'utf8')) as Omit<Regression, 'file'>), file: f }));
}
