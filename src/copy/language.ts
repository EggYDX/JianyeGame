import type { Category, Metric, Predicate } from "../engine/types";
export const CATEGORY_NAMES: Record<Metric, string> = {
  upper: "大写英文字母",
  lower: "小写英文字母",
  digit: "数字",
  punctuation: "特殊字符",
  whitespace: "空白字符",
  other: "其他字符",
  vowel: "英文元音（a、e、i、o、u）",
};
const quantity = (op: string) =>
  op === "min" ? "至少" : op === "max" ? "最多" : "恰好";
export function describe(p: Predicate, _variant = 0): string {
  switch (p.kind) {
    case "length":
      return p.op === "min"
        ? `密码至少需要 ${p.value} 个字符。`
        : `密码${quantity(p.op)}有 ${p.value} 个字符。`;
    case "count":
      return `${quantity(p.op)}包含 ${p.value} 个${CATEGORY_NAMES[p.category]}。`;
    case "contains":
      return p.sensitive
        ? `包含「${p.options[0]}」，区分大小写。`
        : `包含以下任一单词：${p.options.join("、")}（不区分大小写）。`;
    case "forbid":
      return `不能包含「${p.text}」。`;
    case "sequence":
      return `包含连续 ${p.size} 位依次${p.direction === 1 ? "递增" : "递减"}的数字，相邻两位相差 1。`;
    case "boundary":
      return `${p.position === "last" ? "最后一个" : `第 ${p.position} 个`}字符是${CATEGORY_NAMES[p.category as Category]}。`;
    case "repeat":
      return `包含连续 ${p.size} 个相同的${CATEGORY_NAMES[p.category]}。`;
    case "sum":
      return `每一位数字相加，结果为 ${p.value}。`;
    case "wrapped":
      return `把至少一个指定单词放进 ${p.pair[0]} ${p.pair[1]}，括号紧贴单词。`;
    case "order":
      return `最先出现的指定单词排在「${p.code}」前，且不能与它重叠。`;
    case "balance":
      return p.delta === 0
        ? `${CATEGORY_NAMES[p.a]}和${CATEGORY_NAMES[p.b]}的数量相同。`
        : `${CATEGORY_NAMES[p.a]}比${CATEGORY_NAMES[p.b]}${p.delta > 0 ? "多" : "少"} ${Math.abs(p.delta)} 个。`;
    case "split":
      return `「${p.marker}」只出现一次，两侧数字分别相加，前面的总和${p.delta === 0 ? "与后面相同" : `比后面${p.delta > 0 ? "多" : "少"} ${Math.abs(p.delta)}`}。`;
    case "mirror":
      return `最后 ${p.size} 个字符是前 ${p.size} 个字符的倒序，区分大小写。`;
    case "digitGap":
      return "第一个数字和最后一个数字之间不能有英文元音。";
    case "letterSequence":
      return `包含连续 ${p.size} 个英文字母，按字母表顺序逐个${p.direction === 1 ? "递增" : "递减"}（不区分大小写）。`;
    case "distinctDigits":
      return `至少使用 ${p.min} 种不同的数字。`;
    case "wordOccurrence":
      return `以下单词合计只出现 ${p.count} 次：${p.options.join("、")}（不区分大小写，重叠也计数）。`;
    case "bracketBalance":
      return "至少有一对括号；()、[]、{} 都要正确配对，不能交叉。";
    case "tokenGap":
      return `最先出现的指定单词在「${p.code}」前，中间有 ${p.min}～${p.max} 个字符。`;
    case "alternatingParity":
      return `至少有 ${p.min} 位数字，所有数字按出现顺序奇偶交替。`;
  }
}
export const LANGUAGE = {
  platform: "间页",
  next: "继续",
  complete: "注册完成",
  characters: [
    ["字符数", "一个汉字或 emoji 算一个字符，空格也算。"],
    ["英文字母", "A–Z、a–z"],
    ["数字", "0–9"],
    ["特殊字符", "英文键盘上的标点，如 !、@、#、(、)。"],
  ],
} as const;
