/**
 * Platform detection utility.
 * Determines if the app is running inside Tauri or in a regular browser.
 */
export const isTauri = (): boolean => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

export const platform = {
  isTauri: isTauri(),
  isBrowser: !isTauri(),
  isMac:
    typeof navigator !== "undefined" &&
    navigator.userAgent.includes("Macintosh"),
};
