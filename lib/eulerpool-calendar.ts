import { istanbulDay } from "./wire-text";
import { calendarUnit } from "./calendar-values";

const COUNTRIES: Record<string, string> = { tr: "TR", us: "US", cn: "CN", jp: "JP" };
const MAGNITUDES: Record<string, string> = { "1000": "K", "1000000": "M", "1000000000": "B", "1000000000000": "T" };

function reading(row: Record<string, unknown>, prefix: string): string | null {
  const raw = row[`${prefix}_value`];
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  if (typeof raw === "string" && !raw.trim()) return null;
  if (!Number.isFinite(Number(raw))) return null;
  const multiplier = String(row[`${prefix}_multiplier`] ?? "1");
  const currency = typeof row[`${prefix}_currency`] === "string" ? String(row[`${prefix}_currency`]).trim() : "";
  const scale = MAGNITUDES[multiplier] || "";
  // Values already use their own displayed magnitude: 48.44 with a 1e9
  // multiplier is 48.44B, not 48.44 or 48.44e9B. Each column has its own unit.
  const numeric = !scale && Number(multiplier) > 1 ? Number(raw) * Number(multiplier) : raw;
  const inferred = calendarUnit({ originalTitle: String(row.name), country: COUNTRIES[String(row.country_code)] });
  const suffix = currency === "%" ? "%" : currency ? ` ${currency.toUpperCase()}` : !scale && inferred !== "K" ? inferred || "" : "";
  return `${numeric}${scale}${suffix}`;
}

export function normalizeEulerpoolCalendar(payload: unknown, day: string): Record<string, unknown>[] {
  if (!Array.isArray(payload)) throw new Error("Eulerpool calendar response is not an array");
  if (payload.length && !payload.some(row => row && typeof row === "object" && "timestamp" in row && "name" in row && "country_code" in row)) {
    throw new Error("Eulerpool calendar response has an unsupported schema");
  }
  const records = new Map<string, Record<string, unknown>>();
  for (const row of payload) {
    if (!row || typeof row !== "object") continue;
    const countryCode = String(row.country_code).toLowerCase();
    const country = COUNTRIES[countryCode];
    const timestamp = Number(row.timestamp);
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!country || !name || !Number.isFinite(timestamp) || !Number.isFinite(new Date(timestamp).getTime()) || istanbulDay(timestamp) !== day) continue;
    // The source has no event id. Reference period distinguishes simultaneous
    // releases of one indicator for different periods.
    const id = `eulerpool:${countryCode}:${timestamp}:${name}:${row.reference_date ?? ""}`;
    const consensus = reading(row, "consensus");
    const forecast = consensus ?? reading(row, "forecast");
    records.set(id, { id, country, title: name, date: new Date(timestamp).toISOString(),
      actual: reading(row, "actual"), forecast, previous: reading(row, "previous"),
      preformatted: true, unit: null, scale: null, currency: null,
      fullDay: row.full_day === true,
      actualSource: typeof row.actual_source === "string" ? row.actual_source : "eulerpool",
    });
  }
  return [...records.values()].sort((a, b) => Date.parse(String(a.date)) - Date.parse(String(b.date)));
}

export async function fetchEulerpoolCalendar(day: string, apiKey: string) {
  const url = new URL("https://api.eulerpool.com/api/1/macro/calendar");
  const start = Date.parse(`${day}T00:00:00+03:00`);
  url.search = new URLSearchParams({ language: "en", start: String(start), end: String(start + 86_400_000 - 1), countries: "tr,us,cn,jp", token: apiKey }).toString();
  // Never propagate a fetch error containing a token-bearing URL into logs or
  // diagnostic responses.
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  } catch { throw new Error("Eulerpool calendar connection failed"); }
  if (!response.ok) throw new Error(`Eulerpool calendar HTTP ${response.status}`);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new Error("Eulerpool calendar returned invalid JSON"); }
  return { data: { result: normalizeEulerpoolCalendar(payload, day) }, source: "eulerpool" as const,
    sourceUrl: "https://api.eulerpool.com/api/1/macro/calendar", status: response.status, fetchedAt: new Date().toISOString() };
}

export class CalendarBackendError extends Error {
  constructor(message: string, public readonly keyConfigured?: boolean) { super(message); }
}

export async function fetchBackendEulerpoolCalendar(day: string) {
  const base = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://bpt-news-backend.onrender.com").replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${base}/api/macro/calendar`, { cache: "no-store", signal: AbortSignal.timeout(18_000) });
  } catch { throw new CalendarBackendError("Takvim backend bağlantısı kurulamadı"); }
  let payload;
  try { payload = await response.json(); } catch { throw new CalendarBackendError(`Takvim backend HTTP ${response.status}; backend güncellemesini kontrol edin`); }
  const configured = typeof payload.eulerpoolKeyConfigured === "boolean" ? payload.eulerpoolKeyConfigured : undefined;
  if (!response.ok || payload.success !== true) {
    throw new CalendarBackendError(configured === false ? "Render backend EULERPOOL_API_KEY değişkenini okuyamıyor" : `Takvim backend HTTP ${response.status}`, configured);
  }
  if (payload.date !== day || !Array.isArray(payload.records)) throw new CalendarBackendError("Takvim backend gün/veri yanıtı geçersiz", configured);
  return { data: { result: normalizeEulerpoolCalendar(payload.records, day) }, source: "eulerpool" as const,
    sourceUrl: `${base}/api/macro/calendar`, status: response.status, fetchedAt: typeof payload.fetchedAt === "string" ? payload.fetchedAt : new Date().toISOString(),
    stale: payload.stale === true, eulerpoolKeyConfigured: configured, keyLocation: "backend" as const,
    resultSource: payload.resultSource === "tradingview" ? "tradingview" : undefined,
    matching: payload.matching && typeof payload.matching === "object" ? payload.matching as Record<string, unknown> : undefined,
    scheduleFetchedAt: typeof payload.scheduleFetchedAt === "string" ? payload.scheduleFetchedAt : undefined };
}
