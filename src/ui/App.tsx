import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { graphemeSegments } from "unicode-segmenter/grapheme";
import { initialState, nextGateAt, transition } from "../engine/game";
import {
  createAssistance,
  syncAssistance,
  assistanceDueAt,
  checkAssistance,
} from "../engine/assistance";
import { evaluateRules } from "../rules/definitions";
import { CONTENT_VERSION } from "../data/materials";
import { LANGUAGE, describe } from "../copy/language";
import type { GamePlan } from "../engine/types";
import {
  entry,
  readSession,
  restart,
  rememberInvite,
  setLocationSeed,
  validSeed,
  writeSession,
} from "./session";
import workerSource from "virtual:generation-worker";
import DebugPanel, { type Inspection } from "../debug/DebugPanel";
import { copyText } from "./clipboard";
import { Dialog } from "./Dialog";
import { Toast, type ToastMessage } from "./Toast";
import { RuleRow } from "./RuleRow";
import { Icon } from "./Icon";
const now = () => performance.now(),
  reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
type Modal = "invite" | "assistance" | "characters" | "debug" | null;

export default function App() {
  const [config, setConfig] = useState(entry);
  const [state, dispatch] = useReducer(transition, config.sessionId, (id) => ({
    ...initialState(id, now()),
    visible: document.visibilityState === "visible",
  }));
  const [modal, setModal] = useState<Modal>(null);
  const modalOrigin = useRef<HTMLElement | null>(null);
  const [acceptedInvite, setAcceptedInvite] = useState(config.acceptedInvite);
  const [joining, setJoining] = useState(false),
    [inviteError, setInviteError] = useState("");
  const [inspecting, setInspecting] = useState(false),
    [inspection, setInspection] = useState<Inspection | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const announced = useRef({ count: 0, failing: 0 });
  const toastId = useRef(0),
    generation = useRef(0),
    queuedInvite = useRef<string | null>(null);
  const workerRef = useRef<Worker | null>(null),
    accountComposing = useRef(false),
    inviteComposing = useRef(false);
  const account = useRef<HTMLInputElement>(null),
    password = useRef<HTMLTextAreaElement>(null),
    invite = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLDivElement>(null),
    list = useRef<HTMLOListElement>(null);
  const restored = useRef(readSession(config.seed, config.version));
  const [assistance, setAssistance] = useState(() =>
    createAssistance(now(), restored.current?.inspectionEnabled === true),
  );
  const [unseen, setUnseen] = useState(false);
  const previousPositions = useRef(new Map<string, number>()),
    animations = useRef(new Map<string, Animation>());
  const priorCount = useRef(0),
    lastFailure = useRef(0);
  const notify = useCallback(
    (text: string, kind: ToastMessage["kind"] = "success") =>
      setToast({ id: ++toastId.current, text, kind }),
    [],
  );
  const dismissToast = useCallback(
    (id: number) => setToast((t) => (t?.id === id ? null : t)),
    [],
  );
  const visibleRules = useMemo(
    () => state.plan?.rules.slice(0, state.revealedCount) ?? [],
    [state.plan, state.revealedCount],
  );
  // Before Continue, only count graphemes. No analyzer, validator or format feedback.
  const evaluated = useMemo(
    () =>
      state.revealedCount > 0 ? evaluateRules(visibleRules, state.raw) : null,
    [visibleRules, state.raw, state.revealedCount],
  );
  const count = useMemo(
    () =>
      state.raw.length > 8192
        ? null
        : (evaluated?.analysis.graphemes.length ??
          [...graphemeSegments(state.raw)].length),
    [evaluated, state.raw],
  );
  const ordered = visibleRules
    .map((rule, i) => ({ rule, result: evaluated!.results[i] }))
    .sort(
      (a, b) =>
        Number(a.result.passed) - Number(b.result.passed) ||
        b.rule.ordinal - a.rule.ordinal,
    );
  const orderKey = ordered.map((x) => x.rule.id).join("|");
  const failing = evaluated?.results.filter((r) => !r.passed).length ?? 0;
  let prefix = 0;
  for (const result of evaluated?.results ?? []) {
    if (!result.passed) break;
    prefix++;
  }
  const complete = state.stage === "complete";
  const editorMounted =
    state.accountConfirmed && !["initializing", "error"].includes(state.stage);
  const progress = state.revealedCount * 257 + prefix;
  const playing =
    editorMounted &&
    !complete &&
    state.revealedCount > 0 &&
    state.visible &&
    modal === null;

  useEffect(() => {
    if (complete) setAnnouncement("注册完成。");
    else if (state.revealedCount > announced.current.count)
      setAnnouncement(`新要求：${describe(visibleRules.at(-1)!.predicate)}`);
    else if (failing !== announced.current.failing)
      setAnnouncement(
        failing ? `还有 ${failing} 项要求未通过。` : "所有要求均已通过。",
      );
    else if (!state.revealedCount) setAnnouncement("");
    announced.current = { count: state.revealedCount, failing };
  }, [complete, state.revealedCount, failing, visibleRules]);

  useEffect(() => {
    if (!validSeed(config.seed) || config.version !== CONTENT_VERSION) {
      dispatch({
        type: "error",
        message: "链接已失效。",
      });
      return;
    }
    const url = URL.createObjectURL(
      new Blob([workerSource], { type: "text/javascript" }),
    );
    const worker = new Worker(url);
    workerRef.current = worker;
    const fail = () => {
      setJoining(false);
      setInspecting(false);
      dispatch({ type: "error", message: "" });
    };
    const watchdog = setTimeout(() => {
      worker.terminate();
      fail();
    }, 6000);
    worker.onmessage = (
      e: MessageEvent<{
        type: string;
        kind?: string;
        sessionId: string;
        plan?: GamePlan;
        generated?: Inspection["generated"];
        verification?: Inspection["verification"];
        message?: string;
      }>,
    ) => {
      if (e.data.sessionId !== config.sessionId) return;
      if (e.data.type === "ready") {
        clearTimeout(watchdog);
        dispatch({
          type: "ready",
          plan: e.data.plan!,
          now: now(),
          sessionId: config.sessionId,
        });
        if (restored.current) {
          dispatch({ type: "restore", saved: restored.current, now: now() });
          restored.current = null;
        }
        if (queuedInvite.current === config.sessionId) {
          queuedInvite.current = null;
          setJoining(false);
          setAcceptedInvite(true);
          rememberInvite(config.seed);
          setModal(null);
          notify("邀请码已使用");
        }
      } else if (e.data.type === "debug") {
        setInspection({
          generated: e.data.generated!,
          verification: e.data.verification!,
        });
        setInspecting(false);
        setModal("debug");
      } else if (e.data.type === "error") {
        clearTimeout(watchdog);
        if (e.data.kind === "inspect") {
          setInspecting(false);
          notify("暂时无法查看，请重试", "error");
        } else {
          fail();
          notify("暂时无法使用该邀请码，请重试", "error");
        }
      }
    };
    worker.onerror = () => {
      clearTimeout(watchdog);
      fail();
    };
    worker.postMessage({
      kind: "generate",
      seed: config.seed,
      version: config.version,
      sessionId: config.sessionId,
    });
    return () => {
      clearTimeout(watchdog);
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      URL.revokeObjectURL(url);
    };
  }, [config, notify]);
  useEffect(() => {
    const at = nextGateAt(state);
    if (at === null) return;
    const timer = setTimeout(
      () =>
        dispatch({
          type: "gate",
          revision: state.revision,
          sessionId: state.sessionId,
          now: now(),
        }),
      Math.max(1, at - now() + 1),
    );
    return () => clearTimeout(timer);
  }, [state]);
  useEffect(() => {
    const onVisibility = () =>
      dispatch({
        type: "visibility",
        visible: document.visibilityState === "visible",
        now: now(),
      });
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  useLayoutEffect(() => {
    setAssistance((s) => syncAssistance(s, progress, playing, now()));
  }, [progress, playing]);
  useEffect(() => {
    const at = assistanceDueAt(assistance);
    if (at === null) return;
    const timer = setTimeout(
      () => setAssistance((s) => checkAssistance(s, now())),
      Math.max(1, at - now() + 1),
    );
    return () => clearTimeout(timer);
  }, [assistance]);
  useEffect(() => {
    if (state.plan && state.accountConfirmed)
      writeSession({
        seed: config.seed,
        version: config.version,
        username: state.username,
        raw: state.raw,
        revealedCount: state.revealedCount,
        complete,
        inspectionEnabled: assistance.enabled,
      });
  }, [
    config,
    state.plan,
    state.accountConfirmed,
    state.username,
    state.raw,
    state.revealedCount,
    complete,
    assistance.enabled,
  ]);
  useEffect(() => {
    if (matchMedia("(pointer: fine)").matches) account.current?.focus();
  }, []);
  useEffect(() => {
    if (editorMounted && matchMedia("(pointer: fine)").matches)
      password.current?.focus({ preventScroll: true });
  }, [editorMounted]);
  useEffect(() => {
    if (state.failureSerial === lastFailure.current) return;
    lastFailure.current = state.failureSerial;
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
  }, [state.failureSerial]);
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
    if (state.revealedCount > priorCount.current && scroll > 24) {
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
    priorCount.current = state.revealedCount;
  }, [orderKey, state.revealedCount]);
  async function copy(value: string, message: string) {
    try {
      await copyText(value);
      notify(message);
    } catch {
      notify("复制失败，请手动复制", "error");
    }
  }
  function submit() {
    if (state.composing) return;
    const raw = password.current?.value ?? state.raw;
    if (raw !== state.raw) dispatch({ type: "input", raw, now: now() });
    dispatch({ type: "submit", now: now() });
  }
  function connectInvite() {
    if (inviteComposing.current || joining || inspecting) return;
    const code = invite.current?.value ?? "";
    if (code === "EggYDX") {
      if (!acceptedInvite || !state.plan) {
        setInviteError("邀请码无效。");
        return;
      }
      setInspecting(true);
      setInviteError("");
      workerRef.current?.postMessage({
        kind: "inspect",
        seed: config.seed,
        version: config.version,
        sessionId: config.sessionId,
      });
      return;
    }
    if (!validSeed(code)) {
      setInviteError("邀请码为 1～64 位，只能使用英文字母、数字、- 和 _。");
      return;
    }
    if (state.accountConfirmed) return;
    const sessionId = `${code}:${++generation.current}`;
    queuedInvite.current = sessionId;
    restored.current = null;
    setInviteError("");
    setJoining(true);
    setAcceptedInvite(false);
    setInspection(null);
    setAssistance(createAssistance(now()));
    previousPositions.current.clear();
    priorCount.current = 0;
    lastFailure.current = 0;
    dispatch({ type: "new-seed", sessionId, now: now() });
    setLocationSeed(code, CONTENT_VERSION);
    setConfig({
      seed: code,
      version: CONTENT_VERSION,
      sessionId,
      acceptedInvite: false,
    });
  }
  const closeModal = () => setModal(null);
  const declineAssistance = () => {
    setAssistance((s) => ({ ...s, offered: false, declined: true }));
    setModal(null);
  };
  return (
    <div className="app-shell" data-complete={complete}>
      <header className="site-header">
        <div className="brand">
          <Icon name="pages" />
          <span>{LANGUAGE.platform}</span>
        </div>
        <div className="header-actions">
          {!state.accountConfirmed && (
            <button
              className="icon-button"
              type="button"
              aria-label="输入邀请码"
              onClick={(e) => {
                modalOrigin.current = e.currentTarget;
                setInviteError("");
                setModal("invite");
              }}
            >
              <Icon name="ticket" />
            </button>
          )}
          {playing && assistance.offered && !assistance.enabled && (
            <button
              className="icon-button assistance-button"
              type="button"
              aria-label="查看帮助"
              onClick={(e) => {
                modalOrigin.current =
                  document.querySelector<HTMLButtonElement>(
                    ".password-form .primary-button",
                  ) ?? e.currentTarget;
                setModal("assistance");
              }}
            >
              <Icon name="bulb" />
            </button>
          )}
        </div>
      </header>
      <main>
        {state.stage === "account" && (
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
        )}
        {state.stage === "initializing" && (
          <section>
            <h1>设置密码</h1>
            <div className="loading-state" role="status" aria-label="请稍候">
              <Icon name="loading" />
            </div>
          </section>
        )}
        {state.stage === "error" && (
          <section>
            <h1 role={state.error ? undefined : "alert"}>暂时无法继续</h1>
            {state.error && (
              <p className="error-text" role="alert">
                {state.error}
              </p>
            )}
            <div className="form-actions">
              <button className="text-button" onClick={restart}>
                重新开始
              </button>
              <button
                className="primary-button"
                onClick={() => location.reload()}
              >
                重试
              </button>
            </div>
          </section>
        )}
        {editorMounted && (
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
                      modalOrigin.current = e.currentTarget;
                      setModal("characters");
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
                        evaluated
                          ? !evaluated.analysis.valid || failing > 0
                          : false
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
                      inspectionEnabled={assistance.enabled}
                    />
                  ))}
                </ol>
              </section>
            )}
            {complete && (
              <div className="finish-actions">
                <button
                  className="text-button"
                  onClick={() => copy(config.seed, "邀请码已复制")}
                >
                  <Icon name="copy" />
                  复制邀请码
                </button>
              </div>
            )}
          </>
        )}
        <p
          className="visually-hidden"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {announcement}
        </p>
      </main>
      <footer className="site-signature">
        <p>由 EggYDX 制作</p>
        <a
          href="https://github.com/EggYDX"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="external" />
          <span>GitHub 主页</span>
        </a>
      </footer>
      <Toast message={toast} dismiss={dismissToast} scope={modal} />
      {modal === "invite" && (
        <Dialog
          title="使用邀请码"
          onClose={closeModal}
          returnFocus={modalOrigin.current}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              connectInvite();
            }}
          >
            <label htmlFor="invite-code">邀请码</label>
            <input
              ref={invite}
              id="invite-code"
              className="dialog-input"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
              aria-invalid={!!inviteError}
              aria-describedby={inviteError ? "invite-error" : undefined}
              onCompositionStart={() => {
                inviteComposing.current = true;
              }}
              onCompositionEnd={() => {
                inviteComposing.current = false;
              }}
            />
            {inviteError && (
              <p id="invite-error" className="error-text" role="alert">
                {inviteError}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="submit"
                className="primary-button"
                disabled={joining || inspecting}
                aria-busy={joining || inspecting}
              >
                {(joining || inspecting) && <Icon name="loading" />}确认
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === "assistance" && (
        <Dialog
          title="需要帮助吗？"
          onClose={declineAssistance}
          returnFocus={modalOrigin.current}
        >
          <ul className="assistance-details">
            <li>字符数量</li>
            <li>包含的内容</li>
          </ul>
          <div className="modal-actions">
            <button className="text-button" onClick={declineAssistance}>
              暂不需要
            </button>
            <button
              className="primary-button"
              onClick={() => {
                setAssistance((s) => ({ ...s, enabled: true, offered: false }));
                setModal(null);
                setAnnouncement("帮助已开启。");
              }}
            >
              查看详情
            </button>
          </div>
        </Dialog>
      )}
      {modal === "characters" && (
        <Dialog
          title="字符说明"
          onClose={closeModal}
          returnFocus={modalOrigin.current}
        >
          <dl className="character-guide">
            {LANGUAGE.characters.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Dialog>
      )}
      {modal === "debug" && inspection && (
        <Dialog
          title="本局信息"
          onClose={closeModal}
          returnFocus={modalOrigin.current}
        >
          <DebugPanel inspection={inspection} copy={copy} />
        </Dialog>
      )}
    </div>
  );
}
