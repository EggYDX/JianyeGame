import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
export interface ToastMessage {
  id: number;
  text: string;
  kind: "success" | "error" | "info";
}
export function Toast({
  message,
  dismiss,
  scope,
}: {
  message: ToastMessage | null;
  dismiss: (id: number) => void;
  scope: string | null;
}) {
  const [host, setHost] = useState<HTMLElement>(document.body);
  useEffect(() => {
    setHost(
      document.querySelector<HTMLDialogElement>("dialog[open]") ??
        document.body,
    );
  }, [scope, message]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => dismiss(message.id), 4000);
    return () => clearTimeout(t);
  }, [message, dismiss]);
  return createPortal(
    <div className="toast-region">
      {message && (
        <div
          className="toast"
          data-kind={message.kind}
          key={message.id}
          role="status"
          aria-atomic="true"
        >
          <Icon
            name={
              message.kind === "success"
                ? "check"
                : message.kind === "error"
                  ? "x"
                  : "help"
            }
          />
          <span>{message.text}</span>
        </div>
      )}
    </div>,
    host,
  );
}
