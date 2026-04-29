/**
 * Trevor Settings Store
 *
 * A small Zustand-based store with localStorage persistence.
 * The store also drives a side-effect that updates CSS variables on <html>
 * whenever settings change, so theming/font swaps are instant and global.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  AppSettings,
  DEFAULT_SETTINGS,
  THEMES,
  UI_FONTS,
  MONO_FONTS,
} from "./types";

interface SettingsState {
  settings: AppSettings;
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  setMany: (partial: Partial<AppSettings>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      set: (key, value) =>
        set((state) => ({ settings: { ...state.settings, [key]: value } })),
      setMany: (partial) =>
        set((state) => ({ settings: { ...state.settings, ...partial } })),
      reset: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: "trevor.settings.v1",
      version: 1,
    },
  ),
);

/**
 * Apply settings to the DOM. Sets data attributes for theme classes and
 * CSS variables for fonts/sizes/accent. Should be called once on app
 * boot AND subscribed to via useSettings inside a hook.
 */
export function applySettingsToDOM(settings: AppSettings): void {
  const root = document.documentElement;
  // Theme: data-theme attribute drives all theme tokens via globals.css.
  root.setAttribute("data-theme", settings.theme);
  // Light themes get a `light` class so libraries can detect colour scheme.
  const isLight =
    settings.theme === "trevor-light" || settings.theme === "solarized-light";
  if (isLight) root.classList.add("light");
  else root.classList.remove("light");
  root.style.colorScheme = isLight ? "light" : "dark";

  // Fonts: resolve stacks via the lookup tables.
  const uiFont =
    UI_FONTS.find((f) => f.id === settings.uiFontFamily)?.stack ??
    UI_FONTS[0].stack;
  const editorFont =
    UI_FONTS.find((f) => f.id === settings.editorFontFamily)?.stack ??
    UI_FONTS[0].stack;
  const monoFont =
    MONO_FONTS.find((f) => f.id === settings.monoFontFamily)?.stack ??
    MONO_FONTS[0].stack;

  root.style.setProperty("--font-ui", uiFont);
  root.style.setProperty("--font-editor", editorFont);
  root.style.setProperty("--font-mono", monoFont);
  root.style.setProperty("--ui-font-size", `${settings.uiFontSize}px`);
  root.style.setProperty("--editor-font-size", `${settings.editorFontSize}px`);
  root.style.setProperty(
    "--editor-line-height",
    String(settings.editorLineHeight),
  );
  root.style.setProperty(
    "--editor-max-width",
    settings.editorMaxWidth > 0 ? `${settings.editorMaxWidth}px` : "100%",
  );
  root.style.setProperty("--code-font-size", `${settings.codeFontSize}px`);

  // Accent: derive an RGB triple for use in rgba() blends.
  root.style.setProperty("--color-accent", settings.accentColor);
  const rgb = hexToRgb(settings.accentColor);
  if (rgb) {
    root.style.setProperty(
      "--color-accent-rgb",
      `${rgb.r}, ${rgb.g}, ${rgb.b}`,
    );
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace(/^#/, "").match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Get the metadata for the active theme. */
export function getActiveTheme(settings: AppSettings) {
  return THEMES.find((t) => t.id === settings.theme) ?? THEMES[0];
}
