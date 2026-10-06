import { test, expect } from "vitest";
import {
  createAssistance,
  syncAssistance,
  checkAssistance,
  assistanceDueAt,
} from "../src/engine/assistance";
const started = () => syncAssistance(createAssistance(0), 257, true, 0);
test("offer appears only after two active minutes", () => {
  expect(checkAssistance(started(), 119999).offered).toBe(false);
  expect(checkAssistance(started(), 120000).offered).toBe(true);
  expect(assistanceDueAt(createAssistance(0))).toBeNull();
});
test("editing, regressing and repairing do not reset the best progress clock", () => {
  let s = syncAssistance(started(), 200, true, 30000);
  s = syncAssistance(s, 257, true, 60000);
  expect(s.score).toBe(257);
  expect(assistanceDueAt(s)).toBe(120000);
  expect(checkAssistance(s, 120000).offered).toBe(true);
});
test("a new best prefix restarts the clock and re-enables a declined offer", () => {
  const s = syncAssistance(
    { ...started(), declined: true, offered: true },
    258,
    true,
    60000,
  );
  expect(s.elapsed).toBe(0);
  expect(s.declined).toBe(false);
  expect(s.offered).toBe(false);
  expect(assistanceDueAt(s)).toBe(180000);
});
test("background or a modal pauses elapsed time, including stale timer callbacks", () => {
  let s = syncAssistance(started(), 257, false, 60000);
  expect(checkAssistance(s, 999999).offered).toBe(false);
  s = syncAssistance(s, 257, true, 999999);
  expect(assistanceDueAt(s)).toBe(1059999);
  expect(checkAssistance(s, 1059999).offered).toBe(true);
});
test("declining suppresses repeat offers; accepting survives progress and reload initialization", () => {
  expect(assistanceDueAt({ ...started(), declined: true })).toBeNull();
  const enabled = syncAssistance(
    { ...started(), enabled: true },
    600,
    true,
    120000,
  );
  expect(enabled.enabled).toBe(true);
  expect(assistanceDueAt(enabled)).toBeNull();
  expect(
    assistanceDueAt(syncAssistance(createAssistance(0, true), 257, true, 0)),
  ).toBeNull();
});
