// Cross-device sync for the published prototype.
//
// When the page runs as a published claude.ai artifact, it gets a small shared
// document store (`claude.use("db")`). The whole prototype state is kept in one
// document, so a phone and a laptop opening the same link see the same data.
// Anywhere else (npm run dev, a saved file) this returns null and the app keeps
// working in one browser, syncing between tabs only.
//
// This is a demo shortcut, not the production design: last writer wins and the
// whole state is one document. A real backend stores records per pilgrim (README).

import type { State } from "./types";

export interface Shared {
  push(s: State): void;
  stop(): void;
}

interface Doc {
  json: string;
  from: string;
  rev: number;
}

export async function connectShared(tabId: string, onRemote: (s: State) => void, onEmpty: () => void): Promise<Shared | null> {
  const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!claude?.use) return null;
  let db: any = null;
  try {
    db = await claude.use("db");
  } catch {
    return null;
  }
  if (!db) return null;

  const ref = db.doc("rabt/state");
  let lastRev = 0;
  let ready = false;
  let pending: State | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    if (!pending) return;
    const s = pending;
    pending = null;
    lastRev += 1;
    const body: Doc = { json: JSON.stringify(s), from: tabId, rev: lastRev };
    ref.set(body).catch(() => {
      /* offline or over a limit: this device keeps working on its own */
    });
  };

  const unsub = ref.onSnapshot(
    (snap: { exists: boolean; data(): unknown }) => {
      const first = !ready;
      ready = true;
      if (!snap.exists) {
        if (first) onEmpty();
        flush();
        return;
      }
      const d = snap.data() as Doc | undefined;
      if (!d || typeof d.json !== "string") return;
      if (d.from === tabId) {
        lastRev = Math.max(lastRev, d.rev);
        return;
      }
      if (d.rev < lastRev) return;
      lastRev = d.rev;
      try {
        onRemote(JSON.parse(d.json) as State);
      } catch {
        /* ignore a malformed document */
      }
    },
    () => {
      /* subscription ended: keep working locally */
    }
  );

  return {
    push(s: State) {
      pending = s;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (ready) flush();
      }, 250);
    },
    stop() {
      clearTimeout(timer);
      unsub();
    },
  };
}
