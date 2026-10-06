export async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* Fall back when permission or secure-context access is unavailable. */
  }
  const focused = document.activeElement as HTMLElement | null;
  const editor =
    document.querySelector<HTMLTextAreaElement>("#proposed-password");
  const selection =
    editor && ([editor.selectionStart, editor.selectionEnd] as const);
  const input = document.createElement("textarea");
  input.value = text;
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  input.style.cssText = "position:fixed;left:-10000px;top:0";
  // Native dialogs make the rest of the page inert, including clipboard fallbacks.
  (document.querySelector("dialog[open]") ?? document.body).appendChild(input);
  input.select();
  let success = false;
  try {
    success = document.execCommand("copy");
  } finally {
    input.remove();
    focused?.focus({ preventScroll: true });
    if (selection) editor?.setSelectionRange(...selection);
  }
  if (!success) throw new Error("Clipboard unavailable");
}
