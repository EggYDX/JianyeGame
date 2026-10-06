import { graphemeSegments } from "unicode-segmenter/grapheme";
import { INVALID_FORMAT, WHITE_SPACE } from "../data/materials";
import type { Category, Metric } from "./types";

export function classify(g: string): Category {
  if (/^[A-Z]$/.test(g)) return "upper";
  if (/^[a-z]$/.test(g)) return "lower";
  if (/^[0-9]$/.test(g)) return "digit";
  if (/^[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]$/.test(g)) return "punctuation";
  if ([...g].every((c) => WHITE_SPACE.has(c.codePointAt(0)!)))
    return "whitespace";
  return "other";
}
export const asciiFold = (s: string) =>
  s.replace(/[A-Z]/g, (c) => c.toLowerCase());
export interface Analysis {
  raw: string;
  normalized: string;
  graphemes: string[];
  categories: Category[];
  counts: Record<Metric, number>;
  digits: number[];
  digitSum: number;
  valid: boolean;
  formatError: string | null;
  rawRanges: [number, number][];
  matches: (
    options: readonly string[],
    sensitive?: boolean,
  ) => { start: number; end: number; text: string }[];
}
let cached: Analysis | undefined;
export function analyzePassword(raw: string): Analysis {
  if (cached?.raw === raw) return cached;
  cached = computeAnalysis(raw);
  return cached;
}
function computeAnalysis(raw: string): Analysis {
  const tooLarge = raw.length > 8192;
  const rawSegments = tooLarge ? [] : [...graphemeSegments(raw)];
  const graphemes = rawSegments.map((s) => s.segment.normalize("NFC"));
  const categories = graphemes.map(classify);
  const counts: Record<Metric, number> = {
    upper: 0,
    lower: 0,
    digit: 0,
    punctuation: 0,
    whitespace: 0,
    other: 0,
    vowel: 0,
  };
  categories.forEach((c, i) => {
    counts[c]++;
    if (/^[aeiouAEIOU]$/.test(graphemes[i])) counts.vowel++;
  });
  const digits = graphemes
    .filter((_, i) => categories[i] === "digit")
    .map(Number);
  const formatError = tooLarge
    ? "密码太长，请缩短后再试。"
    : INVALID_FORMAT.test(raw)
      ? "请删除密码中的换行或隐藏字符。"
      : graphemes.length > 256
        ? "密码不能超过 256 个字符。"
        : null;
  const cache = new Map<
    string,
    { start: number; end: number; text: string }[]
  >();
  return {
    raw,
    normalized: tooLarge ? raw : raw.normalize("NFC"),
    graphemes,
    categories,
    counts,
    digits,
    digitSum: digits.reduce((a, b) => a + b, 0),
    valid: !formatError,
    formatError,
    rawRanges: rawSegments.map((s) => [s.index, s.index + s.segment.length]),
    matches(options, sensitive = true) {
      const key = `${sensitive}:${JSON.stringify(options)}`;
      if (cache.has(key)) return cache.get(key)!;
      const haystack = sensitive ? graphemes : graphemes.map(asciiFold);
      const found: { start: number; end: number; text: string }[] = [];
      for (const option of options) {
        const needle = [...graphemeSegments(option.normalize("NFC"))].map(
          (s) => (sensitive ? s.segment : asciiFold(s.segment)),
        );
        for (let i = 0; i <= haystack.length - needle.length; i++) {
          if (needle.every((c, j) => c === haystack[i + j]))
            found.push({
              start: i,
              end: i + needle.length,
              text: graphemes.slice(i, i + needle.length).join(""),
            });
        }
      }
      found.sort(
        (a, b) =>
          a.start - b.start || a.end - b.end || (a.text < b.text ? -1 : 1),
      );
      cache.set(key, found);
      return found;
    },
  };
}
export function validateAccount(raw: string): string | null {
  if (raw.length > 8192) return "账户名最多 24 个字符。";
  const a = analyzePassword(raw);
  if (a.graphemes.length > 24) return "账户名最多 24 个字符。";
  if (a.formatError) return "请删除账户名中的换行或隐藏字符。";
  if (!a.graphemes.length || a.categories.every((c) => c === "whitespace"))
    return "请输入账户名。";
  return null;
}
