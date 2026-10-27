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
