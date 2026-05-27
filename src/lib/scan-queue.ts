/**
 * Lightweight offline queue for scanner movements.
 * Persists pending createMovement payloads in localStorage and replays
 * them when the connection returns. Dedupes by client-side UUID so a
 * payload can never be submitted twice.
 */
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

const KEY = "scanner-offline-queue-v1";
const EVT = "scanner-queue-changed";

export type QueueStatus = "online" | "offline" | "syncing";

type MovementInsert = TablesInsert<"inventory_movements">;

export type QueuedItem = {
  id: string; // client uuid
  payload: MovementInsert;
  createdAt: number;
  attempts: number;
};

function uuid() {
  return (
    (globalThis.crypto?.randomUUID?.() as string | undefined) ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function load(): QueuedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedItem[]) : [];
  } catch {
    return [];
  }
}

function save(list: QueuedItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* ignore quota */
  }
}

export function getPending(): QueuedItem[] {
  return load();
}

export function pendingCount(): number {
  return load().length;
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVT, handler);
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  return () => {
    window.removeEventListener(EVT, handler);
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  };
}

/**
 * Submit a movement immediately if online; otherwise queue it.
 * Returns { queued: true } when persisted offline.
 */
export async function submitMovement(
  payload: MovementInsert,
): Promise<{ queued: boolean }> {
  if (isOnline()) {
    const { error } = await supabase.from("inventory_movements").insert(payload);
    if (!error) return { queued: false };
    // Network/offline at request time — fall through and queue
    if (!isNetworkError(error)) throw error;
  }
  enqueue(payload);
  return { queued: true };
}

function enqueue(payload: MovementInsert) {
  const list = load();
  list.push({ id: uuid(), payload, createdAt: Date.now(), attempts: 0 });
  save(list);
}

function isNetworkError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed")
  );
}

let syncing = false;
let listenersInstalled = false;

export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  if (syncing) return { ok: 0, failed: 0 };
  if (!isOnline()) return { ok: 0, failed: 0 };
  syncing = true;
  window.dispatchEvent(new Event(EVT));
  let ok = 0;
  let failed = 0;
  try {
    let list = load();
    for (const item of [...list]) {
      try {
        const { error } = await supabase
          .from("inventory_movements")
          .insert(item.payload);
        if (error) throw error;
        list = list.filter((i) => i.id !== item.id);
        save(list);
        ok++;
      } catch (e) {
        if (isNetworkError(e)) {
          break; // stop, retry later
        }
        // Permanent failure: drop after 3 attempts, otherwise increment
        item.attempts += 1;
        if (item.attempts >= 3) {
          list = list.filter((i) => i.id !== item.id);
          save(list);
        } else {
          save(list);
        }
        failed++;
      }
    }
  } finally {
    syncing = false;
    window.dispatchEvent(new Event(EVT));
  }
  return { ok, failed };
}

/** Install global online/visibility listeners exactly once per tab. */
export function installAutoSync() {
  if (typeof window === "undefined" || listenersInstalled) return;
  listenersInstalled = true;
  const trigger = () => {
    if (isOnline()) void flushQueue();
  };
  window.addEventListener("online", trigger);
  window.addEventListener("focus", trigger);
  document.addEventListener("visibilitychange", trigger);
  // Initial attempt
  trigger();
}

export function isSyncing(): boolean {
  return syncing;
}
