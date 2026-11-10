import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeFeedCache, readFeedCache, writeFeedCache } from "./feed-cache";

test("daily feed cache is stable, keeps translated stories on empty responses and drops yesterday", () => {
  const oldWindow = globalThis.window;
  const oldStorage = globalThis.localStorage;
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) }, configurable: true });
  try {
    const item = { id: "current", timestamp: Date.now(), baslik: "Türkçe haber" };
    writeFeedCache("test-feed", [item, { ...item, id: "yesterday", timestamp: Date.now() - 86_400_000 }]);
    const snapshot = readFeedCache<typeof item>("test-feed");
    assert.equal(snapshot.length, 1);
    assert.equal(readFeedCache("test-feed"), snapshot);
    assert.deepEqual(mergeFeedCache(snapshot, []), [item]);
    const updated = { ...item, baslik: "Güncellenen Türkçe haber" };
    writeFeedCache("test-feed", mergeFeedCache(snapshot, [updated]));
    assert.equal(readFeedCache<typeof item>("test-feed")[0].baslik, updated.baslik);
  } finally {
    Object.defineProperty(globalThis, "window", { value: oldWindow, configurable: true });
    Object.defineProperty(globalThis, "localStorage", { value: oldStorage, configurable: true });
  }
});
