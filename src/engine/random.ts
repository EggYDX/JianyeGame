import { xoroshiro128plus } from "pure-rand/generator/xoroshiro128plus";
import { uniformInt } from "pure-rand/distribution/uniformInt";
import { GENERATION_VERSION } from "../data/materials";
function hash(text: string): number {
  let h = 2166136261;
  for (const byte of new TextEncoder().encode(text)) {
    h ^= byte;
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}
export class SeededRandom {
  private rng;
  constructor(seed: string, stream: string) {
    this.rng = xoroshiro128plus(
      hash(`${GENERATION_VERSION}|${seed}|${stream}`),
    );
  }
  int(min: number, max: number) {
    return uniformInt(this.rng, min, max);
  }
  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }
  shuffle<T>(items: readonly T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    let x = this.int(
      1,
      items.reduce((s, item) => s + weight(item), 0),
    );
    for (const item of items) {
      x -= weight(item);
      if (x <= 0) return item;
    }
    return items[items.length - 1];
  }
  state() {
    return this.rng.getState();
  }
}
