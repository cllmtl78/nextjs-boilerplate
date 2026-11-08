/** Track successful feed snapshots; cached/initial history must never ring. */
export class FeedArrivalTracker {
  private feeds = new Map<string, { day: string; seen: Set<string>; initialized: boolean }>();

  observe(feed: string, ids: readonly (string | number)[], day: string): boolean {
    let state = this.feeds.get(feed);
    if (!state) {
      state = { day, seen: new Set(), initialized: false };
      this.feeds.set(feed, state);
    }
    if (state.day !== day) {
      state.day = day;
      state.seen.clear();
    }
    let arrived = false;
    for (const id of ids) {
      if (id === "" || id == null) continue;
      const key = String(id);
      if (!state.seen.has(key)) {
        if (state.initialized) arrived = true;
        state.seen.add(key);
      }
    }
    state.initialized = true;
    return arrived;
  }
}
