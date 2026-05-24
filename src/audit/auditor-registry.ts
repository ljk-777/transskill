import type { Auditor } from './auditor.interface.js';

const auditors = new Map<string, Auditor>();

export function registerAuditor(auditor: Auditor): void {
  if (auditors.has(auditor.id)) {
    throw new Error(`Auditor '${auditor.id}' is already registered`);
  }
  auditors.set(auditor.id, auditor);
}

export function getAuditor(id: string): Auditor | undefined {
  return auditors.get(id);
}

export function getAuditors(): Auditor[] {
  return Array.from(auditors.values());
}

export function clearAuditors(): void {
  auditors.clear();
}
