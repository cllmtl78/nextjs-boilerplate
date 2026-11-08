"use client";

import { FeedArrivalTracker } from "./news-notifications";
import { istanbulDay } from "./wire-text";

const STORAGE_KEY = "bpt_news_sound_v1";
const tracker = new FeedArrivalTracker();
const listeners = new Set<() => void>();
let enabled = false;
let initialized = false;
let context: AudioContext | undefined;
let pending: ReturnType<typeof setTimeout> | undefined;
let lastPlayed = -Infinity;
const voices = new Set<OscillatorNode>();

export const subscribeSound = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const soundEnabled = () => enabled;
export const serverSoundEnabled = () => false;
const emit = () => listeners.forEach(listener => listener());

export function initializeSound() {
  if (initialized) return;
  initialized = true;
  try { enabled = localStorage.getItem(STORAGE_KEY) === "on"; } catch { /* Optional storage. */ }
  emit();
}

async function unlockAudio() {
  const Audio = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Audio) throw new Error("Ses bu tarayıcıda desteklenmiyor.");
  if (!context || context.state === "closed") context = new Audio();
  if (context.state === "suspended") await context.resume();
  if (context.state !== "running") throw new Error("Ses etkinleştirilemedi. Zile tekrar dokun.");
}

// One bell strike: simultaneous partials, a clear attack and a soft ringing tail.
function playBell() {
  if (!enabled || !context || context.state !== "running") return;
  const audio = context;
  const start = audio.currentTime;
  for (const [frequency, volume, decay] of [[1046, 0.075, 0.8], [2092, 0.025, 0.4], [2814, 0.009, 0.24]]) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    gain.gain.linearRampToValueAtTime(0, start + decay + 0.025);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    voices.add(oscillator);
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start);
    oscillator.stop(start + decay + 0.03);
  }
  lastPlayed = performance.now();
}

export async function toggleSound(): Promise<void> {
  initializeSound();
  if (pending) { clearTimeout(pending); pending = undefined; }
  if (enabled) {
    enabled = false;
    for (const voice of voices) { try { voice.stop(); } catch { /* Already ended. */ } }
  } else {
    await unlockAudio();
    enabled = true;
    playBell(); // Preview only on an explicit off -> on action.
  }
  try { localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off"); } catch { /* Optional storage. */ }
  emit();
}

/** Restored preferences need a user gesture to unlock browser audio. No preview. */
export function resumeSavedSound() {
  if (enabled) void unlockAudio().catch(() => { /* Explicit bell toggle can retry. */ });
}

export function observeFeedArrivals(feed: string, items: readonly { id: string | number }[]) {
  const arrived = tracker.observe(feed, items.map(item => item.id), istanbulDay(Date.now()));
  if (!arrived || !enabled || context?.state !== "running" || pending || performance.now() - lastPlayed < 4000) return;
  pending = setTimeout(() => { pending = undefined; playBell(); }, 400);
}
