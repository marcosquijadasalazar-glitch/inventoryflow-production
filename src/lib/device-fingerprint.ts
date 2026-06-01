// Stable per-browser fingerprint stored in localStorage.
// Intentionally low-entropy: a random UUID plus a tiny stable signal from
// the UA/platform/timezone. Used only to detect "new device" patterns
// in the security log — never for auth decisions.

const KEY = "if.security.device_fp.v1";

function hashString(input: string): string {
  // Tiny non-crypto hash (FNV-1a 32-bit) — adequate for a coarse signal.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

export function getDeviceFingerprint(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      const rand =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      const sig = [
        navigator.userAgent ?? "",
        navigator.language ?? "",
        navigator.platform ?? "",
        Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
        `${screen.width}x${screen.height}`,
      ].join("|");
      id = `${rand.slice(0, 8)}-${hashString(sig)}`;
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
