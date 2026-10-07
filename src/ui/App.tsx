import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { initialState, nextGateAt, transition } from "../engine/game";
import {
  createAssistance,
  assistanceProgress,
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
import { AccountStep, PasswordStep } from "./GameSteps";
import { useRuleAnimations } from "./useRuleAnimations";
import { Icon } from "./Icon";
const now = () => performance.now();
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
  const { unseen, setUnseen } = useRuleAnimations(
    field,
    list,
    state.failureSerial,
    state.revealedCount,
    config.sessionId,
  );
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
  const failing = evaluated?.results.filter((r) => !r.passed).length ?? 0;
  const complete = state.stage === "complete";
  const editorMounted =
    state.accountConfirmed && !["initializing", "error"].includes(state.stage);
  const progress = assistanceProgress(
    state.revealedCount,
    evaluated?.results ?? [],
  );
  const playing =
    editorMounted &&
    !complete &&
    state.revealedCount > 0 &&
    state.visible &&
    modal === null;

  useEffect(() => {
    if (complete) setAnnouncement("注册完成。");
    else if (state.revealedCount > announced.current.count)
      setAnnouncement(describe(visibleRules.at(-1)!.predicate));
    else if (failing !== announced.current.failing)
      setAnnouncement(
        failing ? `还有 ${failing} 处需要改一改。` : "可以继续了。",
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
          <AccountStep
            state={state}
            dispatch={dispatch}
            joining={joining}
            account={account}
            field={field}
          />
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
          <PasswordStep
            state={state}
            dispatch={dispatch}
            evaluated={evaluated}
            password={password}
            field={field}
            list={list}
            assistanceEnabled={assistance.enabled}
            unseen={unseen}
            setUnseen={setUnseen}
            onCharacters={(origin) => {
              modalOrigin.current = origin;
              setModal("characters");
            }}
            submit={submit}
            copy={copy}
            seed={config.seed}
          />
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
                setAnnouncement("可以查看详情了。");
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
