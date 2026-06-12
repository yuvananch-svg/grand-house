export function nowIso(): string {
  return new Date().toISOString();
}

export function todayBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function dateOffsetBangkok(source: string, days: number): string {
  const base = Date.parse(`${source}T00:00:00+07:00`);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(base + days * 86_400_000));
}

export function monthBangkok(): string {
  return todayBangkok().slice(0, 7);
}

export function makeId(prefix: string): string {
  const stamp = Math.floor(Date.now() / 1000);
  const random = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${stamp}-${random}`.toUpperCase();
}

export function makeClientId(prefix: string, deviceId: string): string {
  const deviceSuffix = (deviceId || "UNKNOWN").replace(/[^a-z0-9]/gi, "").slice(-8) || "UNKNOWN";
  return `${makeId(prefix)}-${deviceSuffix}`.toUpperCase();
}

export function getOrCreateDeviceId(): string {
  const key = "grands-house-device-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = `DEV-${crypto.randomUUID()}`;
  localStorage.setItem(key, id);
  return id;
}
