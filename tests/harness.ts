// Minimal headless test harness (no dependencies). Each test file registers tests on import.
export interface TestCase { name: string; file: string; fn: () => void | Promise<void> }
export const registry: TestCase[] = [];
let currentFile = '';
export function setFile(f: string): void { currentFile = f; }
export function test(name: string, fn: () => void | Promise<void>): void {
  registry.push({ name, file: currentFile, fn });
}
export class AssertionError extends Error {}
export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new AssertionError(msg);
}
export function eq<T>(a: T, b: T, msg: string): void {
  if (a !== b) throw new AssertionError(`${msg}: expected ${String(b)}, got ${String(a)}`);
}
