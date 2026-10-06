import { WORDS, PAIRS, MARKERS } from "../data/materials";
import { SeededRandom } from "./random";
export interface WitnessProfile {
  text: string;
  word: string;
  options: string[];
  code: string;
  pair: [string, string];
  direction: 1 | -1;
  sequenceSize: number;
  marker: string;
  freeOffset: number;
  alphabetDirection: 1 | -1;
}
export function buildWitness(
  rng: SeededRandom,
  fallback = false,
): WitnessProfile {
  // Pick authored materials and structural intent before deriving numeric parameters.
  const options = rng.shuffle(WORDS).slice(0, 3),
    word = rng.pick(options),
    pair = rng.pick(PAIRS),
    marker = rng.pick(MARKERS);
  const workingLength = rng.int(36, 42);
  const direction: 1 | -1 = rng.pick([1, -1]),
    sequenceSize = rng.int(3, 4);
  const start = direction === 1 ? rng.int(1, 5) : rng.int(4, 8);
  const sequence = Array.from(
    { length: sequenceSize },
    (_, i) => start + direction * i,
  ).join("");
  // Authored global rhythm, rather than a property discovered after construction.
  const parityDigit = (parity: number) =>
    rng.pick([1, 2, 3, 4, 5, 6, 7, 8].filter((n) => n % 2 === parity));
  const code =
    rng.pick(["TX", "NR", "FD", "BK", "SV", "LC"]) +
    parityDigit(start % 2) +
    String(parityDigit(1 - (start % 2)));
  const prefix = rng.pick(["Qab", "Ren", "Tuv", "Nix", "Vob", "Set"]);
  const echo = rng.pick(["jj", "mm", "ss", "kk", "zz"]);
  const wordCase = fallback
    ? word
    : word.slice(0, 1).toUpperCase() + word.slice(1);
  const tail = Array.from({ length: rng.int(2, 3) }, (_, i) =>
    parityDigit(((start % 2) + sequenceSize + i) % 2),
  ).join("");
  const alphabetDirection: 1 | -1 = rng.pick([1, -1]);
  const letterRun = rng.pick(["bcd", "fgh", "klm", "pqr", "uvw"]);
  const alphabet =
    alphabetDirection === 1 ? letterRun : [...letterRun].reverse().join("");
  const bridge = rng.pick(["bc", "mn", "st"]);
  const coreFiller =
    rng.pick(["aeio", "ioue", "ueoa", "oaae"]) + echo + alphabet;
  const padding =
    workingLength -
    (prefix.length * 2 +
      word.length +
      2 +
      code.length +
      sequence.length +
      marker.length +
      tail.length +
      coreFiller.length);
  const bridgePadding = padding - bridge.length;
  const filler =
    coreFiller +
    rng
      .pick(["bn", "kj", "mz"])
      .repeat(Math.ceil(bridgePadding / 2))
      .slice(0, bridgePadding);
  const chunks =
    fallback || rng.int(0, 1)
      ? [
          prefix,
          pair[0] + wordCase + pair[1],
          bridge,
          code,
          sequence,
          marker,
          tail,
          filler,
          prefix.split("").reverse().join(""),
        ]
      : [
          prefix,
          filler,
          pair[0] + wordCase + pair[1],
          bridge,
          code,
          sequence,
          marker,
          tail,
          prefix.split("").reverse().join(""),
        ];
  const text = chunks.join("");
  return {
    text,
    word,
    options,
    code,
    pair,
    direction,
    sequenceSize,
    marker,
    freeOffset: text.indexOf(filler),
    alphabetDirection,
  };
}
