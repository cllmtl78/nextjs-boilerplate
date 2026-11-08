import { test } from "node:test";
import assert from "node:assert/strict";
import { FeedArrivalTracker } from "./news-notifications";

test("initial history silent; new batch rings once; repeat and reorder silent", () => {
  const tracker = new FeedArrivalTracker();
  assert.equal(tracker.observe("bist", [1, 2], "2026-11-08"), false);
  assert.equal(tracker.observe("bist", [4, 3, 2, 1], "2026-11-08"), true);
  assert.equal(tracker.observe("bist", [1, 2, 3, 4], "2026-11-08"), false);
  assert.equal(tracker.observe("bist", [4], "2026-11-08"), false);
  assert.equal(tracker.observe("bist", [1, 4], "2026-11-08"), false);
});
test("each feed has an independent silent baseline, including empty snapshots", () => {
  const tracker = new FeedArrivalTracker();
  for (const feed of ["bist", "global", "kap", "official-news", "crypto-news"]) {
    assert.equal(tracker.observe(feed, [], "2026-11-08"), false);
    assert.equal(tracker.observe(feed, ["a"], "2026-11-08"), true);
  }
});
test("new day keeps notifications active and clears previous IDs", () => {
  const tracker = new FeedArrivalTracker();
  tracker.observe("bist", [1], "2026-11-08");
  assert.equal(tracker.observe("bist", [], "2026-11-09"), false);
  assert.equal(tracker.observe("bist", [1], "2026-11-09"), true);
});
