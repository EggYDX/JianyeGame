import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
export function Dialog({
  title,
  onClose,
  children,
  returnFocus,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  returnFocus?: HTMLElement | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const node = dialog.current!,
      previous = document.activeElement as HTMLElement | null;
    node.showModal();
    return () => {
      node.close();
      const target = returnFocus?.isConnected ? returnFocus : previous;
      if (target?.isConnected) target.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        close.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close.current();
        }
      }}
    >
      <div className="modal-header">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="关闭"
          onClick={onClose}
          type="button"
        >
          <Icon name="x" />
        </button>
      </div>
      {children}
    </dialog>,
    document.body,
  );
}
