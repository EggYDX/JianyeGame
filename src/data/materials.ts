export const CONTENT_VERSION = "4";
// This release changes copy while keeping the existing seeded puzzles.
export const GENERATION_VERSION = "3";
export const WORDS = [
  "river",
  "cloud",
  "stone",
  "quiet",
  "orbit",
  "lemon",
  "maple",
  "field",
  "coral",
  "night",
  "amber",
  "grove",
] as const;
export const PAIRS: [string, string][] = [
  ["[", "]"],
  ["(", ")"],
  ["{", "}"],
];
export const MARKERS = ["#", ":", "/"] as const;
// Unicode White_Space, frozen for this content version. No locale-dependent regex.
export const WHITE_SPACE = new Set([
  9, 10, 11, 12, 13, 32, 133, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197,
  8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288,
]);
export const INVALID_FORMAT =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b\u200e\u200f\u2028-\u202e\u2060-\u206f\ufeff]/u;
