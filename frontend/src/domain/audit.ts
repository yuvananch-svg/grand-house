import type { LocalState } from "../types";

export function verifyChain(log: LocalState["auditLog"]): { ok: boolean; brokenAt?: string } {
  if (!log.length) return { ok: true };
  let previous = log[0].prev_hash;
  for (const row of log) {
    if (row.prev_hash !== previous) return { ok: false, brokenAt: row.id };
    previous = row.row_hash;
  }
  return { ok: true };
}

export function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function csvCell(value: unknown): string {
  const raw = String(value ?? "");
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}
