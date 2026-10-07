export const CONTENT_VERSION = "5";
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
  "apple",
  "beach",
  "bloom",
  "bread",
  "brush",
  "chair",
  "charm",
  "chess",
  "clear",
  "dream",
  "earth",
  "flame",
  "grass",
  "green",
  "honey",
  "light",
  "music",
  "ocean",
  "olive",
  "peach",
  "plant",
  "plume",
  "shore",
  "smile",
  "spark",
  "sweet",
  "water",
  "wheat",
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
