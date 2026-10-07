import type { Analysis } from "../engine/analyzer";
import { CATEGORY_NAMES } from "../copy/language";
import type { Predicate, RuleInstance, RuleResult } from "../engine/types";
const compare = (x: number, op: string, y: number) =>
  op === "min" ? x >= y : op === "max" ? x <= y : x === y;
export function validatePredicate(p: Predicate, a: Analysis): RuleResult {
  let passed = false,
    detail = "",
    fragments: string[] = [];
  switch (p.kind) {
    case "length":
      passed = compare(a.graphemes.length, p.op, p.value);
      detail = `${a.graphemes.length} 个字符`;
      break;
    case "count":
      passed = compare(a.counts[p.category], p.op, p.value);
      detail = `${a.counts[p.category]} 个${CATEGORY_NAMES[p.category]}`;
      break;
    case "contains": {
      const hits = a.matches(p.options, p.sensitive);
      passed = hits.length > 0;
      fragments = hits.map((h) => h.text);
      detail = fragments.join("、") || "0 次";
      break;
    }
    case "forbid": {
      const hits = a.matches([p.text]);
      passed = !hits.length;
      detail = `「${p.text}」× ${hits.length}`;
      break;
    }
    case "sum":
      passed = a.digitSum === p.value;
      detail = a.digits.length
        ? `${a.digits.join(" + ")} = ${a.digitSum}`
        : "0";
      break;
    case "sequence": {
      for (let i = 0; i <= a.graphemes.length - p.size; i++) {
        const slice = a.graphemes.slice(i, i + p.size);
        if (
          slice.every(
            (g, j) =>
              /^[0-9]$/.test(g) &&
              (!j || Number(g) - Number(slice[j - 1]) === p.direction),
          )
        )
          fragments.push(slice.join(""));
      }
      passed = fragments.length > 0;
      detail = [...new Set(fragments)].join("、") || "0 处";
      break;
    }
    case "boundary": {
      const i = p.position === "last" ? a.graphemes.length - 1 : p.position - 1;
      passed = i >= 0 && a.categories[i] === p.category;
      detail = a.graphemes[i] ? `「${a.graphemes[i]}」` : "—";
      fragments = a.graphemes[i] ? [a.graphemes[i]] : [];
      break;
    }
    case "relativePosition": {
      const code = a.matches([p.code])[0];
      const i = code ? (p.side === "before" ? code.start - 1 : code.end) : -1;
      passed = i >= 0 && a.categories[i] === p.category;
      fragments = a.graphemes[i] ? [a.graphemes[i]] : [];
      detail = fragments.length ? `「${fragments[0]}」` : "—";
      break;
    }
    case "repeat": {
      for (let i = 0; i <= a.graphemes.length - p.size; i++)
        if (
          a.categories[i] === p.category &&
          a.graphemes.slice(i, i + p.size).every((g) => g === a.graphemes[i])
        )
          fragments.push(a.graphemes.slice(i, i + p.size).join(""));
      passed = fragments.length > 0;
      detail = [...new Set(fragments)].join("、") || "0 处";
      break;
    }
    case "wrapped": {
      const hits = a.matches(
        p.options.map((o) => `${p.pair[0]}${o}${p.pair[1]}`),
        false,
      );
      passed = hits.length > 0;
      fragments = hits.map((h) => h.text);
      detail = fragments.join("、") || "0 处";
      break;
    }
    case "order": {
      const word = a.matches(p.options, false)[0],
        code = a.matches([p.code])[0];
      passed = !!word && !!code && word.end <= code.start;
      detail = `单词：${word ? `第 ${word.start + 1} 位` : "—"}；${p.code}：${code ? `第 ${code.start + 1} 位` : "—"}`;
      break;
    }
    case "balance":
      passed = a.counts[p.a] === a.counts[p.b] + p.delta;
      detail = `${CATEGORY_NAMES[p.a]} ${a.counts[p.a]} 个；${CATEGORY_NAMES[p.b]} ${a.counts[p.b]} 个。`;
      break;
    case "split": {
      const hits = a.matches([p.marker]);
      let before = 0,
        after = 0;
      if (hits.length === 1)
        a.graphemes.forEach((g, i) => {
          if (a.categories[i] === "digit") {
            if (i < hits[0].start) before += Number(g);
            else after += Number(g);
          }
        });
      passed = hits.length === 1 && before === after + p.delta;
      detail =
        hits.length === 1
          ? `两侧总和：${before} / ${after}`
          : `「${p.marker}」× ${hits.length}`;
      break;
    }
    case "mirror": {
      const first = a.graphemes.slice(0, p.size).join(""),
        last = a.graphemes.slice(-p.size).join("");
      passed =
        a.graphemes.length >= 2 * p.size &&
        a.graphemes.slice(0, p.size).reverse().join("") === last;
      detail = `开头「${first}」；末尾「${last}」。`;
      fragments = [first, last];
      break;
    }
    case "digitGap": {
      const start = a.categories.indexOf("digit"),
        end = a.categories.lastIndexOf("digit");
      const vowels = a.graphemes
        .slice(start, end + 1)
        .filter((g) => /^[aeiouAEIOU]$/.test(g));
      passed = start >= 0 && !vowels.length;
      detail = start < 0 ? "0 位数字" : `${vowels.length} 个英文元音`;
      break;
    }
    case "letterSequence": {
      for (let i = 0; i <= a.graphemes.length - p.size; i++) {
        const slice = a.graphemes.slice(i, i + p.size);
        if (
          slice.every(
            (g, j) =>
              /^[A-Za-z]$/.test(g) &&
              (!j ||
                g.toLowerCase().charCodeAt(0) -
                  slice[j - 1].toLowerCase().charCodeAt(0) ===
                  p.direction),
          )
        )
          fragments.push(slice.join(""));
      }
      passed = fragments.length > 0;
      detail = [...new Set(fragments)].join("、") || "0 处";
      break;
    }
    case "distinctDigits": {
      const distinct = [...new Set(a.digits)];
      passed = distinct.length >= p.min;
      detail = `${distinct.length} 种${distinct.length ? `：${distinct.join("、")}` : ""}`;
      break;
    }
    case "wordOccurrence": {
      const hits = a.matches(p.options, false);
      const unique = hits.filter(
        (h, i) =>
          hits.findIndex(
            (other) => other.start === h.start && other.end === h.end,
          ) === i,
      );
      passed = unique.length === p.count;
      fragments = unique.map((h) => h.text);
      detail = `${unique.length} 次${unique.length ? `：${fragments.join("、")}` : ""}`;
      break;
    }
    case "bracketBalance": {
      const stack: string[] = [];
      const closing: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
      let pairs = 0,
        mismatch = 0;
      for (const g of a.graphemes) {
        if (["(", "[", "{"].includes(g)) stack.push(g);
        else if (closing[g]) {
          if (stack.at(-1) !== closing[g]) mismatch++;
          else {
            stack.pop();
            pairs++;
          }
        }
      }
      passed = pairs > 0 && mismatch === 0 && stack.length === 0;
      detail = `${pairs} 对；${stack.length + mismatch} 个未配对`;
      break;
    }
    case "tokenGap": {
      const word = a.matches(p.options, false)[0],
        code = a.matches([p.code])[0];
      const gap = word && code ? code.start - word.end : null;
      passed = gap !== null && gap >= p.min && gap <= p.max;
      detail =
        gap === null || gap < 0
          ? `单词：${word ? `第 ${word.start + 1} 位` : "—"}；${p.code}：${code ? `第 ${code.start + 1} 位` : "—"}`
          : `${gap} 个字符`;
      break;
    }
    case "alternatingParity": {
      let breaks = 0;
      for (let i = 1; i < a.digits.length; i++)
        if (a.digits[i] % 2 === a.digits[i - 1] % 2) breaks++;
      passed = a.digits.length >= p.min && breaks === 0;
      detail = a.digits.length ? a.digits.join("、") : "0 位数字";
      break;
    }
  }
  return { passed: passed && a.valid, detail, fragments };
}
export const validateRule = (r: RuleInstance, a: Analysis) =>
  validatePredicate(r.predicate, a);
