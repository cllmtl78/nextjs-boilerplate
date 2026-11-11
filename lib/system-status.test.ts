import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSystemHealth } from "./system-status";

test("healthy requires every monitored service to report success", async () => {
  const saved = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = (async input => {
    const path = new URL(String(input)).pathname;
    paths.push(path);
    return Response.json({ status: path === "/" ? "running" : "ok", translation_state: "ready" });
  }) as typeof fetch;
  try {
    const result = await checkSystemHealth("https://backend.example/");
    assert.equal(result.state, "ok");
    assert.equal(result.services.length, 8);
    assert.ok(!paths.includes("/api/macro/calendar"));
    assert.ok(!paths.includes("/api/macro/us-debt"));
  } finally { globalThis.fetch = saved; }
});

test("HTTP 200 does not hide a partial feed or translation quota failure", async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = (async input => {
    const path = new URL(String(input)).pathname;
    return Response.json(path === "/api/official-news" ? { status: "partial" }
      : path === "/api/crypto-news" ? { status: "ok", translation_state: "rate_limited" }
      : { status: "ok" });
  }) as typeof fetch;
  try {
    const result = await checkSystemHealth("https://backend.example");
    assert.equal(result.state, "degraded");
    assert.equal(result.services.find(service => service.name === "Resmî")?.state, "degraded");
    assert.equal(result.services.find(service => service.name === "Kripto")?.state, "degraded");
  } finally { globalThis.fetch = saved; }
});

test("a failed service produces partial access without dropping other checks", async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = (async input => new URL(String(input)).pathname === "/api/kap"
    ? new Response("unavailable", { status: 503 }) : Response.json({ status: "ok" })) as typeof fetch;
  try {
    const result = await checkSystemHealth("https://backend.example");
    assert.equal(result.state, "degraded");
    assert.equal(result.services.filter(service => service.state === "ok").length, 7);
  } finally { globalThis.fetch = saved; }
});

test("network failures never return a healthy state or raw error details", async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("private network error"); }) as typeof fetch;
  try {
    const result = await checkSystemHealth("https://backend.example");
    assert.equal(result.state, "unavailable");
    assert.ok(!JSON.stringify(result).includes("private network error"));
  } finally { globalThis.fetch = saved; }
});
