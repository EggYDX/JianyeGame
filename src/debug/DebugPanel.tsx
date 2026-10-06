import type { GeneratedGame } from "../engine/types";
import { describe } from "../copy/language";
import { Icon } from "../ui/Icon";
export interface Inspection {
  generated: GeneratedGame;
  verification: { prefixesValid: boolean; certificatesValid: boolean };
}
export default function DebugPanel({
  inspection,
  copy,
}: {
  inspection: Inspection;
  copy: (value: string, message: string) => void;
}) {
  const { generated: g, verification: v } = inspection;
  return (
    <div className="debug-panel">
      <dl className="debug-facts">
        <dt>邀请码</dt>
        <dd>
          <code>{g.plan.seed}</code>
        </dd>
        <dt>密码要求</dt>
        <dd>{g.plan.rules.length} 项</dd>
        <dt>完成检查</dt>
        <dd
          className={v.prefixesValid ? "verified" : ""}
          role="img"
          aria-label={v.prefixesValid ? "可以完成" : "暂时无法确认"}
        >
          <Icon name={v.prefixesValid ? "check" : "help"} />
        </dd>
      </dl>
      {v.prefixesValid && (
        <details>
          <summary>参考密码</summary>
          <p className="debug-witness">{g.witness}</p>
          <button
            className="text-button"
            onClick={() => copy(g.witness, "密码已复制")}
          >
            复制密码
          </button>
        </details>
      )}
      <details>
        <summary>全部要求</summary>
        <ol className="debug-rules">
          {g.plan.rules.map((r) => (
            <li key={r.id}>
              <p>{describe(r.predicate, r.copyVariant)}</p>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
