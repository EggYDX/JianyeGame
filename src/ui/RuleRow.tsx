import { useState } from "react";
import type { RuleInstance, RuleResult } from "../engine/types";
import { describe } from "../copy/language";
import { Icon } from "./Icon";
export function RuleRow({
  rule,
  result,
  inspectionEnabled,
}: {
  rule: RuleInstance;
  result: RuleResult;
  inspectionEnabled: boolean;
}) {
  const [open, setOpen] = useState(false),
    [pinned, setPinned] = useState(false);
  const contents = (
    <>
      <span className="rule-symbol">
        <Icon name="x" className="failed-symbol" />
        <Icon name="check" className="passed-symbol" />
      </span>
      <span className="rule-copy">
        {describe(rule.predicate, rule.copyVariant)}
      </span>
    </>
  );
  return (
    <li
      className="rule-row"
      data-id={rule.id}
      data-ordinal={rule.ordinal}
      data-passed={result.passed}
    >
      {inspectionEnabled ? (
        <button
          className="rule-content"
          type="button"
          aria-label={`${result.passed ? "通过" : "未通过"}：${describe(rule.predicate, rule.copyVariant)}`}
          aria-expanded={open}
          aria-controls={`detail-${rule.id}`}
          onPointerEnter={(e) => {
            if (
              e.pointerType === "mouse" &&
              matchMedia("(hover: hover)").matches
            )
              setOpen(true);
          }}
          onPointerLeave={() => {
            if (!pinned) setOpen(false);
          }}
          onClick={() => {
            const next = !pinned;
            setPinned(next);
            setOpen(next);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setPinned(false);
              setOpen(false);
            }
          }}
        >
          {contents}
          <Icon name="chevron" className="detail-chevron" />
        </button>
      ) : (
        <div
          className="rule-content"
          aria-label={`${result.passed ? "通过" : "未通过"}：${describe(rule.predicate, rule.copyVariant)}`}
        >
          {contents}
        </div>
      )}
      {inspectionEnabled && open && (
        <p className="rule-detail" id={`detail-${rule.id}`}>
          {result.detail}
        </p>
      )}
    </li>
  );
}
