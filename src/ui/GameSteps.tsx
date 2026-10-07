import { useMemo, useRef, type Dispatch, type RefObject } from "react";
import { graphemeSegments } from "unicode-segmenter/grapheme";
import type { GameState, GameEvent } from "../engine/game";
import { evaluateRules } from "../rules/definitions";
import { restart } from "./session";
import { Icon } from "./Icon";
import { RuleRow } from "./RuleRow";
const now = () => performance.now();
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function AccountStep({
  state,
  dispatch,
  joining,
  account,
  field,
}: {
  state: GameState;
  dispatch: Dispatch<GameEvent>;
  joining: boolean;
  account: RefObject<HTMLInputElement | null>;
  field: RefObject<HTMLDivElement | null>;
}) {
  const accountComposing = useRef(false);
  return (
    <section className="account-form">
      <h1>创建账号</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!accountComposing.current)
            dispatch({
              type: "account",
              username: account.current?.value ?? "",
              now: now(),
            });
        }}
      >
        <label htmlFor="account-name">账户名</label>
        <div className="account-field" ref={field}>
          <input
            ref={account}
            id="account-name"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!state.error}
            aria-describedby={state.error ? "account-error" : undefined}
            enterKeyHint="next"
            onCompositionStart={() => {
              accountComposing.current = true;
            }}
            onCompositionEnd={() => {
              accountComposing.current = false;
            }}
          />
        </div>
        {state.error && (
          <p id="account-error" className="error-text" role="alert">
            {state.error}
          </p>
        )}
        <div className="form-actions">
          <button
            className="primary-button"
            type="submit"
            disabled={joining || !state.plan}
          >
            继续
          </button>
        </div>
      </form>
    </section>
  );
}

export function PasswordStep({
  state,
  dispatch,
  evaluated,
  password,
  field,
  list,
  assistanceEnabled,
  unseen,
  setUnseen,
  onCharacters,
  submit,
  copy,
  seed,
}: {
  state: GameState;
  dispatch: Dispatch<GameEvent>;
  evaluated: ReturnType<typeof evaluateRules> | null;
  password: RefObject<HTMLTextAreaElement | null>;
  field: RefObject<HTMLDivElement | null>;
  list: RefObject<HTMLOListElement | null>;
  assistanceEnabled: boolean;
  unseen: boolean;
  setUnseen: Dispatch<React.SetStateAction<boolean>>;
  onCharacters: (origin: HTMLElement) => void;
  submit: () => void;
  copy: (value: string, message: string) => void;
  seed: string;
}) {
  const complete = state.stage === "complete";
  const failing = evaluated?.results.filter((r) => !r.passed).length ?? 0;
  const count = useMemo(
    () =>
      state.raw.length > 8192
        ? null
        : (evaluated?.analysis.graphemes.length ??
          [...graphemeSegments(state.raw)].length),
    [evaluated, state.raw],
  );
  const ordered = (state.plan?.rules.slice(0, state.revealedCount) ?? [])
    .map((rule, i) => ({ rule, result: evaluated!.results[i] }))
    .reverse();
  return (
    <>
      <section className="password-form">
        <h1>{complete ? "注册完成" : "设置密码"}</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="field-label">
            <label htmlFor="proposed-password">密码</label>
            <button
              className="icon-button"
              aria-label="字符说明"
              type="button"
              onClick={(e) => {
                onCharacters(e.currentTarget);
              }}
            >
              <Icon name="help" />
            </button>
          </div>
          <div className="password-line">
            <div
              className="password-field"
              ref={field}
              data-error={
                !!evaluated &&
                (!evaluated.analysis.valid ||
                  (state.failureSerial > 0 && failing > 0))
              }
            >
              <textarea
                ref={password}
                id="proposed-password"
                name="proposed-password"
                rows={1}
                wrap="soft"
                defaultValue={state.raw}
                readOnly={complete}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="off"
                enterKeyHint="done"
                aria-invalid={
                  evaluated ? !evaluated.analysis.valid || failing > 0 : false
                }
                aria-describedby={
                  evaluated?.analysis.formatError
                    ? "format-error character-count"
                    : "character-count"
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.nativeEvent.isComposing &&
                    e.nativeEvent.keyCode !== 229
                  ) {
                    e.preventDefault();
                    submit();
                  }
                }}
                onInput={(e) =>
                  dispatch({
                    type: "input",
                    raw: e.currentTarget.value,
                    now: now(),
                  })
                }
                onCompositionStart={() =>
                  dispatch({
                    type: "composition",
                    active: true,
                    now: now(),
                  })
                }
                onCompositionEnd={(e) => {
                  dispatch({
                    type: "input",
                    raw: e.currentTarget.value,
                    now: now(),
                  });
                  dispatch({
                    type: "composition",
                    active: false,
                    now: now(),
                  });
                }}
              />
            </div>
            <span
              id="character-count"
              className="character-count"
              aria-label={count === null ? "输入过长" : `${count} 个字符`}
            >
              {count ?? "—"}
            </span>
          </div>
          {evaluated?.analysis.formatError && (
            <p id="format-error" className="error-text" role="status">
              {evaluated.analysis.formatError}
            </p>
          )}
          <div className="form-actions">
            {complete ? (
              <>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => copy(state.raw, "密码已复制")}
                >
                  复制密码
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={restart}
                >
                  重新开始
                </button>
              </>
            ) : (
              <button
                className="primary-button"
                type="submit"
                disabled={state.composing || state.completionRequested}
                aria-busy={state.completionRequested}
              >
                {state.completionRequested && <Icon name="loading" />}继续
              </button>
            )}
          </div>
        </form>
      </section>
      {state.revealedCount > 0 && (
        <section className="requirements" aria-label="密码要求">
          {unseen && (
            <button
              className="new-rule-link text-button"
              onClick={() => {
                const latest = list.current?.querySelector<HTMLElement>(
                  `[data-ordinal="${state.revealedCount}"]`,
                );
                list.current?.scrollTo({
                  top: latest?.offsetTop ?? 0,
                  behavior: reduced() ? "instant" : "smooth",
                });
                setUnseen(false);
              }}
            >
              查看新要求
            </button>
          )}
          <ol
            className="rule-list"
            ref={list}
            aria-label="密码要求"
            onScroll={() => {
              if ((list.current?.scrollTop ?? 0) < 16) setUnseen(false);
            }}
          >
            {ordered.map(({ rule, result }) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                result={result}
                inspectionEnabled={assistanceEnabled}
              />
            ))}
          </ol>
        </section>
      )}
      {complete && (
        <div className="finish-actions">
          <button
            className="text-button"
            onClick={() => copy(seed, "邀请码已复制")}
          >
            <Icon name="copy" />
            复制邀请码
          </button>
        </div>
      )}
    </>
  );
}
