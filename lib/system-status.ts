export type ServiceCheck = { name: string; state: "ok" | "degraded" | "unavailable" };
export type SystemHealth = { state: "ok" | "degraded" | "unavailable"; checkedAt: string; services: ServiceCheck[] };

const SERVICES = [
  ["Terminal", "/"], ["BIST", "/api/bist-news"], ["KAP", "/api/kap"],
  ["Global", "/api/global-news"], ["Kripto", "/api/crypto-news"],
  ["Resmî", "/api/official-news"], ["BPT Finans", "/api/bpt-news"], ["Makro", "/api/macro"],
];

export async function checkSystemHealth(base: string): Promise<SystemHealth> {
  const services: ServiceCheck[] = await Promise.all(SERVICES.map(async ([name, path]) => {
    try {
      const response = await fetch(`${base.replace(/\/$/, "")}${path}`, { cache: "no-store", signal: AbortSignal.timeout(7000) });
      if (!response.ok) return { name, state: "unavailable" as const };
      const body = await response.json();
      const healthy = (body.status === "ok" || body.status === "running") && body.translation_state !== "rate_limited";
      return { name, state: healthy ? "ok" as const : "degraded" as const };
    } catch {
      return { name, state: "unavailable" as const };
    }
  }));
  return {
    state: services.every(service => service.state === "ok") ? "ok" : services.every(service => service.state === "unavailable") ? "unavailable" : "degraded",
    checkedAt: new Date().toISOString(), services,
  };
}
