export type CaseUpdate = { status?: string; inScope?: boolean };

export function definedCaseUpdate(input: CaseUpdate): CaseUpdate {
  return {
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.inScope !== undefined ? { inScope: input.inScope } : {}),
  };
}

export function applyCaseUpdate<T extends { status: string; inScope: boolean }>(current: T, updates: CaseUpdate): T {
  const next = { ...current };
  if (updates.status !== undefined) next.status = updates.status;
  if (updates.inScope !== undefined) next.inScope = updates.inScope;
  return next;
}

export function restoreMissingScope<T extends { key: string; inScope?: boolean }>(cases: T[], defaultScopes: ReadonlyMap<string, boolean>): Array<T & { inScope: boolean }> {
  return cases.map(item => typeof item.inScope === "boolean"
    ? item as T & { inScope: boolean }
    : { ...item, inScope: defaultScopes.get(item.key) ?? true });
}

export function selectVersionedCases<T>(stored: unknown, version: string, fallback: T[]) {
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    const value = stored as { version?: unknown; cases?: unknown };
    if (value.version === version && Array.isArray(value.cases)) return { cases: value.cases as T[], needsMigration: false };
  }
  if (fallback.length) return { cases: fallback, needsMigration: true };
  if (Array.isArray(stored)) return { cases: stored as T[], needsMigration: false };
  if (stored && typeof stored === "object" && Array.isArray((stored as { cases?: unknown }).cases)) {
    return { cases: (stored as { cases: T[] }).cases, needsMigration: false };
  }
  return { cases: fallback, needsMigration: false };
}
