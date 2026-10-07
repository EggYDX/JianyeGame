import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export function useRuleAnimations(
  field: RefObject<HTMLDivElement | null>,
  list: RefObject<HTMLOListElement | null>,
  failureSerial: number,
  revealedCount: number,
  sessionId: string,
) {
  const [unseen, setUnseen] = useState(false);
  const previousPositions = useRef(new Map<string, number>()),
    animations = useRef(new Map<string, Animation>());
  const priorCount = useRef(0),
    lastFailure = useRef(0);
  useLayoutEffect(() => {
    animations.current.forEach((a) => a.cancel());
    animations.current.clear();
    previousPositions.current.clear();
    priorCount.current = 0;
    lastFailure.current = 0;
    setUnseen(false);
  }, [sessionId]);
  useEffect(() => {
    if (failureSerial === lastFailure.current) return;
    lastFailure.current = failureSerial;
    const el = field.current;
    if (!el) return;
    el.getAnimations().forEach((a) => a.cancel());
    if (!reduced())
      el.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-3px)" },
          { transform: "translateX(3px)" },
          { transform: "translateX(-2px)" },
          { transform: "translateX(1px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 230, easing: "ease-in-out" },
      );
    list.current
      ?.querySelectorAll<HTMLElement>('[data-passed="false"]')
      .forEach((row) => {
        if (!reduced())
          row.animate(
            [{ borderColor: "#cf7280" }, { borderColor: "#ecd2d7" }],
            { duration: 360 },
          );
      });
  }, [failureSerial]);
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top,
      scroll = el.scrollTop;
    const measurements = [...el.querySelectorAll<HTMLElement>("[data-id]")].map(
      (node) => {
        const id = node.dataset.id!,
          matrix = getComputedStyle(node).transform,
          translate = matrix === "none" ? 0 : new DOMMatrixReadOnly(matrix).m42;
        return {
          node,
          id,
          next: node.getBoundingClientRect().top - top + scroll - translate,
          from: previousPositions.current.get(id),
          translate,
        };
      },
    );
    if (revealedCount > priorCount.current && scroll > 24) {
      const anchor = [...previousPositions.current]
        .sort((a, b) => a[1] - b[1])
        .find(([, y]) => y >= scroll - 3);
      const next = anchor && measurements.find((x) => x.id === anchor[0]);
      if (anchor && next) el.scrollTop = scroll + next.next - anchor[1];
      setUnseen(true);
    }
    for (const { node, id, next, from, translate } of measurements) {
      animations.current.get(id)?.cancel();
      if (!reduced()) {
        if (from !== undefined && Math.abs(from + translate - next) > 1)
          animations.current.set(
            id,
            node.animate(
              [
                { transform: `translateY(${from + translate - next}px)` },
                { transform: "translateY(0)" },
              ],
              { duration: 210, easing: "cubic-bezier(.22,1,.36,1)" },
            ),
          );
        else if (from === undefined)
          animations.current.set(
            id,
            node.animate(
              [
                { opacity: 0, transform: "translateY(-4px)" },
                { opacity: 1, transform: "translateY(0)" },
              ],
              { duration: 190, easing: "cubic-bezier(.22,1,.36,1)" },
            ),
          );
      }
    }
    previousPositions.current = new Map(
      measurements.map((x) => [x.id, x.next]),
    );
    priorCount.current = revealedCount;
  }, [revealedCount, sessionId]);

  useEffect(
    () => () => {
      animations.current.forEach((a) => a.cancel());
      animations.current.clear();
    },
    [],
  );
  return { unseen, setUnseen };
}
