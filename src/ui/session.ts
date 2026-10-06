import { CONTENT_VERSION } from "../data/materials";
import type { SavedSession } from "../engine/game";
export const FLOW_VERSION = "4";
export const SESSION_KEY = `supplementary-terms:v${CONTENT_VERSION}:flow${FLOW_VERSION}`;
const INVITE_KEY = `${SESSION_KEY}:invite`;
export const validSeed = (seed: string) => /^[A-Za-z0-9_-]{1,64}$/.test(seed);
export function rememberInvite(seed: string) {
  try {
    sessionStorage.setItem(INVITE_KEY, seed);
  } catch {
    /* Optional storage. */
  }
}
function inviteWasAccepted(seed: string) {
  try {
    return sessionStorage.getItem(INVITE_KEY) === seed;
  } catch {
    return false;
  }
}
export function setLocationSeed(seed: string, version: string) {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("seed", seed);
  url.searchParams.set("v", version);
  try {
    history.replaceState(null, "", url);
  } catch {
    /* file: history may be restricted. */
  }
}
export function entry() {
  const query = new URLSearchParams(location.search);
  const seed =
    query.get("seed") ??
    [...crypto.getRandomValues(new Uint32Array(4))]
      .map((n) => n.toString(16).padStart(8, "0"))
      .join("");
  const version = query.get("v") ?? CONTENT_VERSION;
  setLocationSeed(seed, version);
  return {
    seed,
    version,
    acceptedInvite: inviteWasAccepted(seed),
    sessionId: `${seed}:0`,
  };
}
export function readSession(
  seed: string,
  version: string,
): SavedSession | null {
  try {
    const x = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
    return x &&
      x.seed === seed &&
      x.version === version &&
      typeof x.username === "string" &&
      typeof x.raw === "string"
      ? x
      : null;
  } catch {
    return null;
  }
}
export function writeSession(saved: SavedSession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(saved));
  } catch {
    /* In-memory play continues when storage is blocked. */
  }
}
export function restart() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* Storage is optional. */
  }
  const url = new URL(location.href);
  url.searchParams.delete("seed");
  url.searchParams.delete("v");
  url.searchParams.delete("debug");
  location.assign(url);
}
