/**
 * Polyfill localStorage untuk environment test (Node 26 + jsdom:
 * global `localStorage` Node bisa undefined tanpa flag --localstorage-file,
 * sehingga shadow punya jsdom). In-memory Storage cukup untuk persist.
 */

class MemoryStorage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

function ensureStorage(target: object): void {
  try {
    const cur = (target as { localStorage?: { setItem?: unknown } }).localStorage;
    if (cur && typeof cur.setItem === "function") return;
  } catch {
    /* lanjut instal polyfill */
  }
  Object.defineProperty(target, "localStorage", {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
    enumerable: false,
  });
}

ensureStorage(globalThis);
if (typeof window !== "undefined" && window !== (globalThis as unknown as Window)) {
  ensureStorage(window);
}
