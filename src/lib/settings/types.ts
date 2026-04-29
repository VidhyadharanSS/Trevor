/**
 * Trevor Settings — types for the global settings store.
 *
 * Settings are persisted to localStorage and applied via CSS variables
 * + class names on <html>, so changes propagate instantly across the app.
 */

export type ThemeId =
  | "trevor-dark"
  | "trevor-light"
  | "midnight"
  | "solarized-dark"
  | "solarized-light"
  | "dracula"
  | "nord"
  | "gruvbox-dark"
  | "monokai";

export type FontFamilyId =
  | "inter"
  | "system"
  | "serif-charter"
  | "serif-georgia"
  | "ibm-plex-sans"
  | "ibm-plex-serif"
  | "atkinson-hyperlegible";

export type MonoFontId =
  | "jetbrains-mono"
  | "fira-code"
  | "ibm-plex-mono"
  | "menlo"
  | "consolas"
  | "ui-monospace";

export type EditorMode = "source" | "live" | "preview";

export type ToolbarPosition = "top" | "bottom";

export interface AppSettings {
  // Appearance
  theme: ThemeId;
  accentColor: string; // hex, drives --color-accent
  uiFontFamily: FontFamilyId;
  editorFontFamily: FontFamilyId; // for prose
  monoFontFamily: MonoFontId;
  uiFontSize: number; // px (12-18)
  editorFontSize: number; // px (13-22)
  editorLineHeight: number; // 1.4-2.0
  editorMaxWidth: number; // px (640-1200) or 0 for full
  // Editor behaviour
  showLineNumbers: boolean;
  showWordCount: boolean;
  showReadingTime: boolean;
  spellCheck: boolean;
  autoSave: boolean;
  autoSaveDelay: number; // ms
  defaultEditorMode: EditorMode;
  /** Position of the formatting toolbar within the editor pane. */
  editorToolbarPosition: ToolbarPosition;
  /** Show the toolbar at all? Some users prefer keyboard-only. */
  showEditorToolbar: boolean;
  // Code blocks
  codeTheme: "auto" | "github-dark" | "monokai" | "dracula" | "nord";
  codeFontSize: number;
  codeTabSize: number;
  codeWrapLines: boolean;
  codeShowLineNumbers: boolean;
  // Markdown
  smartTypography: boolean; // smart quotes, em-dash, etc.
  showInvisibles: boolean; // show whitespace markers
  // Files
  defaultNoteFolder: string; // path within vault, "" = root
  attachmentsFolder: string; // for pasted images
  newNoteTemplate: string;
  // Privacy & sync (placeholders for later phases)
  telemetry: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "trevor-dark",
  accentColor: "#7c5cff",
  uiFontFamily: "inter",
  editorFontFamily: "inter",
  monoFontFamily: "jetbrains-mono",
  uiFontSize: 14,
  editorFontSize: 16,
  editorLineHeight: 1.7,
  editorMaxWidth: 800,
  showLineNumbers: false,
  showWordCount: true,
  showReadingTime: true,
  spellCheck: true,
  autoSave: true,
  autoSaveDelay: 500,
  defaultEditorMode: "live",
  editorToolbarPosition: "top",
  showEditorToolbar: true,
  codeTheme: "auto",
  codeFontSize: 14,
  codeTabSize: 2,
  codeWrapLines: false,
  codeShowLineNumbers: true,
  smartTypography: true,
  showInvisibles: false,
  defaultNoteFolder: "",
  attachmentsFolder: "attachments",
  newNoteTemplate: "",
  telemetry: false,
};

export const THEMES: Array<{
  id: ThemeId;
  name: string;
  description: string;
  preview: { bg: string; surface: string; text: string; accent: string };
}> = [
  {
    id: "trevor-dark",
    name: "Trevor Dark",
    description: "The original. Deep slate with violet accents.",
    preview: { bg: "#0f0f0f", surface: "#1a1a1a", text: "#e4e4e7", accent: "#7c5cff" },
  },
  {
    id: "trevor-light",
    name: "Trevor Light",
    description: "Bright, paper-like canvas for daytime writing.",
    preview: { bg: "#fafafa", surface: "#ffffff", text: "#18181b", accent: "#6d28d9" },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Pure black OLED-friendly with blue accents.",
    preview: { bg: "#000000", surface: "#0a0a0a", text: "#e5e5e5", accent: "#3b82f6" },
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    description: "Ethan Schoonover's classic, dark variant.",
    preview: { bg: "#002b36", surface: "#073642", text: "#93a1a1", accent: "#268bd2" },
  },
  {
    id: "solarized-light",
    name: "Solarized Light",
    description: "Warm cream paper with muted ink.",
    preview: { bg: "#fdf6e3", surface: "#eee8d5", text: "#586e75", accent: "#268bd2" },
  },
  {
    id: "dracula",
    name: "Dracula",
    description: "Vibrant purples and pinks on midnight.",
    preview: { bg: "#282a36", surface: "#44475a", text: "#f8f8f2", accent: "#bd93f9" },
  },
  {
    id: "nord",
    name: "Nord",
    description: "Cool arctic palette with frosty highlights.",
    preview: { bg: "#2e3440", surface: "#3b4252", text: "#eceff4", accent: "#88c0d0" },
  },
  {
    id: "gruvbox-dark",
    name: "Gruvbox Dark",
    description: "Retro warm earthy tones.",
    preview: { bg: "#282828", surface: "#3c3836", text: "#ebdbb2", accent: "#fe8019" },
  },
  {
    id: "monokai",
    name: "Monokai",
    description: "Classic syntax-highlight palette.",
    preview: { bg: "#272822", surface: "#3e3d32", text: "#f8f8f2", accent: "#a6e22e" },
  },
];

export const UI_FONTS: Array<{ id: FontFamilyId; name: string; stack: string }> = [
  { id: "inter", name: "Inter", stack: '"Inter", system-ui, sans-serif' },
  { id: "system", name: "System Default", stack: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  { id: "ibm-plex-sans", name: "IBM Plex Sans", stack: '"IBM Plex Sans", system-ui, sans-serif' },
  { id: "atkinson-hyperlegible", name: "Atkinson Hyperlegible", stack: '"Atkinson Hyperlegible", system-ui, sans-serif' },
  { id: "serif-charter", name: "Charter (Serif)", stack: '"Charter", "Iowan Old Style", "Georgia", serif' },
  { id: "serif-georgia", name: "Georgia (Serif)", stack: '"Georgia", "Times New Roman", serif' },
  { id: "ibm-plex-serif", name: "IBM Plex Serif", stack: '"IBM Plex Serif", "Georgia", serif' },
];

export const MONO_FONTS: Array<{ id: MonoFontId; name: string; stack: string }> = [
  { id: "jetbrains-mono", name: "JetBrains Mono", stack: '"JetBrains Mono", ui-monospace, monospace' },
  { id: "fira-code", name: "Fira Code", stack: '"Fira Code", ui-monospace, monospace' },
  { id: "ibm-plex-mono", name: "IBM Plex Mono", stack: '"IBM Plex Mono", ui-monospace, monospace' },
  { id: "ui-monospace", name: "System Monospace", stack: 'ui-monospace, "SF Mono", monospace' },
  { id: "menlo", name: "Menlo", stack: '"Menlo", "Monaco", monospace' },
  { id: "consolas", name: "Consolas", stack: '"Consolas", "Courier New", monospace' },
];

export const ACCENT_PRESETS = [
  { name: "Violet", hex: "#7c5cff" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Lime", hex: "#84cc16" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Orange", hex: "#f97316" },
  { name: "Rose", hex: "#f43f5e" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Fuchsia", hex: "#d946ef" },
];
