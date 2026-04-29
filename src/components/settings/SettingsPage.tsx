/**
 * Trevor — Settings Page
 *
 * Full-screen modal that exposes every persisted preference through a
 * categorised left rail.  Each section consumes the Zustand `useSettings`
 * store directly so changes apply instantly across the app via the
 * `applySettingsToDOM` side-effect bound in main.tsx.
 */
import { useState, useMemo } from "react";
import {
  X, Palette, Type, FileText, Code2, Folder, Shield,
  Sun, Moon, Monitor, RotateCcw, Check, Zap,
} from "lucide-react";
import { useSettings } from "@/lib/settings/store";
import {
  THEMES, UI_FONTS, MONO_FONTS, ACCENT_PRESETS,
  AppSettings, FontFamilyId, MonoFontId, ThemeId, EditorMode, ToolbarPosition,
} from "@/lib/settings/types";
import { Toggle } from "@/components/ui/Toggle";
import { SnippetSection } from "./SnippetSection";

interface SettingsPageProps {
  onClose: () => void;
}

type SectionId =
  | "appearance"
  | "typography"
  | "editor"
  | "code"
  | "snippets"
  | "files"
  | "privacy";

const SECTIONS: Array<{ id: SectionId; label: string; icon: React.ElementType }> = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "typography", label: "Typography", icon: Type },
  { id: "editor",     label: "Editor",     icon: FileText },
  { id: "code",       label: "Code Blocks", icon: Code2 },
  { id: "snippets",   label: "Snippets",   icon: Zap },
  { id: "files",      label: "Files",      icon: Folder },
  { id: "privacy",    label: "Privacy",    icon: Shield },
];

export function SettingsPage({ onClose }: SettingsPageProps) {
  const [section, setSection] = useState<SectionId>("appearance");
  const settings = useSettings((s) => s.settings);
  const set = useSettings((s) => s.set);
  const reset = useSettings((s) => s.reset);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl h-[80vh] bg-trevor-bg-secondary border border-trevor-border rounded-xl shadow-elevation-2 flex overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 bg-trevor-bg-tertiary border-r border-trevor-border flex flex-col">
          <div className="px-5 py-4 border-b border-trevor-border-subtle">
            <h2 className="text-[15px] font-semibold text-trevor-text">Settings</h2>
            <p className="text-[11px] text-trevor-text-muted mt-0.5">
              Customise your Trevor experience
            </p>
          </div>
          <nav className="flex-1 py-2">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = s.id === section;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={`w-full flex items-center gap-2.5 px-5 py-2 text-[13px] transition-colors ${
                    active
                      ? "bg-trevor-surface-hover text-trevor-text border-l-2 border-trevor-accent"
                      : "text-trevor-text-secondary hover:text-trevor-text hover:bg-trevor-surface-hover/50"
                  }`}
                >
                  <Icon size={14} /> {s.label}
                </button>
              );
            })}
          </nav>
          <button
            onClick={() => {
              if (confirm("Reset every setting to default?")) reset();
            }}
            className="m-3 px-3 py-2 text-[12px] text-trevor-text-muted hover:text-trevor-danger flex items-center gap-2 rounded hover:bg-trevor-surface-hover transition-colors"
          >
            <RotateCcw size={13} /> Reset to defaults
          </button>
        </aside>

        {/* Main panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-6 py-3 border-b border-trevor-border-subtle">
            <h3 className="text-[14px] font-medium text-trevor-text">
              {SECTIONS.find((s) => s.id === section)?.label}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-trevor-text-muted hover:text-trevor-text hover:bg-trevor-surface-hover transition-colors"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-6">
            {section === "appearance" && (
              <AppearanceSection settings={settings} set={set} />
            )}
            {section === "typography" && (
              <TypographySection settings={settings} set={set} />
            )}
            {section === "editor" && (
              <EditorSection settings={settings} set={set} />
            )}
            {section === "code" && (
              <CodeSection settings={settings} set={set} />
            )}
            {section === "snippets" && <SnippetSection />}
            {section === "files" && (
              <FilesSection settings={settings} set={set} />
            )}
            {section === "privacy" && (
              <PrivacySection settings={settings} set={set} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Section helpers ───────────────────────────────────────────────── */

interface SectionProps {
  settings: AppSettings;
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

function FieldRow({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 border-b border-trevor-border-subtle last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-trevor-text">{label}</div>
        {hint && <p className="text-[11.5px] text-trevor-text-muted mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Select<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="bg-trevor-bg-elevated border border-trevor-border rounded px-2.5 py-1.5 text-[12.5px] text-trevor-text focus:border-trevor-accent outline-none min-w-[180px]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function Slider({
  value, min, max, step = 1, onChange, suffix = "",
}: {
  value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-trevor-accent"
      />
      <span className="text-[12px] text-trevor-text-muted w-12 text-right tabular-nums">
        {value}{suffix}
      </span>
    </div>
  );
}

/* ─── Appearance ───────────────────────────────────────────────────── */

function AppearanceSection({ settings, set }: SectionProps) {
  const isLight = useMemo(
    () => settings.theme === "trevor-light" || settings.theme === "solarized-light",
    [settings.theme],
  );
  return (
    <div className="space-y-6">
      <div>
        <div className="text-[13px] font-medium text-trevor-text mb-2">Quick mode</div>
        <div className="flex gap-2">
          {[
            { id: "trevor-dark", label: "Dark", icon: Moon },
            { id: "trevor-light", label: "Light", icon: Sun },
            { id: "midnight", label: "OLED", icon: Monitor },
          ].map((m) => {
            const Icon = m.icon;
            const active = settings.theme === m.id;
            return (
              <button
                key={m.id}
                onClick={() => set("theme", m.id as ThemeId)}
                className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-lg border transition-all ${
                  active
                    ? "border-trevor-accent bg-trevor-accent/10"
                    : "border-trevor-border bg-trevor-bg-tertiary hover:bg-trevor-surface-hover"
                }`}
              >
                <Icon size={18} className={active ? "text-trevor-accent" : "text-trevor-text-muted"} />
                <span className={`text-[12px] ${active ? "text-trevor-text" : "text-trevor-text-secondary"}`}>
                  {m.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[13px] font-medium text-trevor-text mb-2">Theme</div>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => {
            const active = settings.theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => set("theme", t.id)}
                className={`text-left p-3 rounded-lg border transition-all ${
                  active
                    ? "border-trevor-accent ring-1 ring-trevor-accent/40"
                    : "border-trevor-border hover:bg-trevor-surface-hover"
                }`}
                style={{ backgroundColor: t.preview.bg }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span style={{ color: t.preview.text }} className="text-[12.5px] font-medium">
                    {t.name}
                  </span>
                  {active && <Check size={14} style={{ color: t.preview.accent }} />}
                </div>
                <div className="flex gap-1.5">
                  <span className="w-5 h-5 rounded-full" style={{ background: t.preview.accent }} />
                  <span className="w-5 h-5 rounded-full" style={{ background: t.preview.surface }} />
                  <span className="w-5 h-5 rounded-full border" style={{ background: t.preview.bg, borderColor: t.preview.surface }} />
                </div>
                <p style={{ color: t.preview.text, opacity: 0.6 }} className="text-[10.5px] mt-2">
                  {t.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[13px] font-medium text-trevor-text mb-2">
          Accent colour
        </div>
        <div className="flex flex-wrap gap-2">
          {ACCENT_PRESETS.map((c) => {
            const active = settings.accentColor.toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.hex}
                onClick={() => set("accentColor", c.hex)}
                className={`w-8 h-8 rounded-full transition-all ${
                  active ? "ring-2 ring-offset-2 ring-offset-trevor-bg-secondary ring-trevor-text" : ""
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            );
          })}
          <label className="w-8 h-8 rounded-full border-2 border-dashed border-trevor-border cursor-pointer flex items-center justify-center text-[10px] text-trevor-text-muted hover:border-trevor-accent hover:text-trevor-accent transition-colors">
            <input
              type="color"
              value={settings.accentColor}
              onChange={(e) => set("accentColor", e.target.value)}
              className="opacity-0 w-0 h-0"
            />
            ✚
          </label>
        </div>
        <p className="text-[11px] text-trevor-text-muted mt-2">
          Currently using <code className="text-trevor-accent">{settings.accentColor}</code>{" "}
          on a {isLight ? "light" : "dark"} canvas.
        </p>
      </div>
    </div>
  );
}

/* ─── Typography ───────────────────────────────────────────────────── */

function TypographySection({ settings, set }: SectionProps) {
  return (
    <div>
      <FieldRow label="UI font" hint="Used for sidebar, menus, status bar.">
        <Select<FontFamilyId>
          value={settings.uiFontFamily}
          onChange={(v) => set("uiFontFamily", v)}
          options={UI_FONTS.map((f) => ({ value: f.id, label: f.name }))}
        />
      </FieldRow>
      <FieldRow label="UI size" hint="Smaller = denser layout.">
        <Slider
          value={settings.uiFontSize} min={11} max={18}
          onChange={(v) => set("uiFontSize", v)} suffix="px"
        />
      </FieldRow>

      <FieldRow label="Editor font" hint="Used in the writing area & preview.">
        <Select<FontFamilyId>
          value={settings.editorFontFamily}
          onChange={(v) => set("editorFontFamily", v)}
          options={UI_FONTS.map((f) => ({ value: f.id, label: f.name }))}
        />
      </FieldRow>
      <FieldRow label="Editor size">
        <Slider
          value={settings.editorFontSize} min={13} max={22}
          onChange={(v) => set("editorFontSize", v)} suffix="px"
        />
      </FieldRow>
      <FieldRow label="Line height">
        <Slider
          value={settings.editorLineHeight} min={1.4} max={2.0} step={0.05}
          onChange={(v) => set("editorLineHeight", v)}
        />
      </FieldRow>
      <FieldRow label="Editor max width" hint="Comfortable reading column. 0 = full width.">
        <Slider
          value={settings.editorMaxWidth} min={0} max={1200} step={20}
          onChange={(v) => set("editorMaxWidth", v)} suffix="px"
        />
      </FieldRow>

      <FieldRow label="Monospace font" hint="Used in code blocks & inline code.">
        <Select<MonoFontId>
          value={settings.monoFontFamily}
          onChange={(v) => set("monoFontFamily", v)}
          options={MONO_FONTS.map((f) => ({ value: f.id, label: f.name }))}
        />
      </FieldRow>

      {/* Live preview */}
      <div className="mt-6 p-4 bg-trevor-bg-tertiary border border-trevor-border rounded-lg">
        <div className="text-[10px] uppercase tracking-wider text-trevor-text-muted mb-2">Live preview</div>
        <h2 className="text-[20px] font-semibold text-trevor-text mb-2"
            style={{ fontFamily: "var(--font-editor)" }}>
          The quick brown fox jumps over the lazy dog
        </h2>
        <p className="text-[15px] text-trevor-text-secondary leading-relaxed mb-2"
           style={{ fontFamily: "var(--font-editor)" }}>
          Pack my box with five dozen liquor jugs — sphinx of black quartz, judge my vow.
        </p>
        <code className="text-[13px] text-trevor-accent" style={{ fontFamily: "var(--font-mono)" }}>
          const trevor = "the writing app for thinking"
        </code>
      </div>
    </div>
  );
}

/* ─── Editor ───────────────────────────────────────────────────────── */

function EditorSection({ settings, set }: SectionProps) {
  return (
    <div>
      <FieldRow label="Default mode" hint="What you see when opening a note.">
        <Select<EditorMode>
          value={settings.defaultEditorMode}
          onChange={(v) => set("defaultEditorMode", v)}
          options={[
            { value: "source",  label: "Source (raw markdown)" },
            { value: "live",    label: "Live (split view)" },
            { value: "preview", label: "Preview (rendered)" },
          ]}
        />
      </FieldRow>
      <FieldRow label="Show formatting toolbar" hint="Disable for a keyboard-only editor.">
        <Toggle
          value={settings.showEditorToolbar}
          onChange={(v) => set("showEditorToolbar", v)}
        />
      </FieldRow>
      <FieldRow label="Toolbar position" hint="Place formatting controls above or below the writing area.">
        <Select<ToolbarPosition>
          value={settings.editorToolbarPosition}
          onChange={(v) => set("editorToolbarPosition", v)}
          options={[
            { value: "top",    label: "Top (above editor)" },
            { value: "bottom", label: "Bottom (above status bar)" },
          ]}
        />
      </FieldRow>
      <FieldRow label="Auto-save" hint="Save edits automatically while typing.">
        <Toggle value={settings.autoSave} onChange={(v) => set("autoSave", v)} />
      </FieldRow>
      <FieldRow label="Auto-save delay" hint="Idle delay before persisting.">
        <Slider
          value={settings.autoSaveDelay} min={200} max={3000} step={100}
          onChange={(v) => set("autoSaveDelay", v)} suffix="ms"
        />
      </FieldRow>
      <FieldRow label="Spell-check">
        <Toggle value={settings.spellCheck} onChange={(v) => set("spellCheck", v)} />
      </FieldRow>
      <FieldRow label="Show word count">
        <Toggle value={settings.showWordCount} onChange={(v) => set("showWordCount", v)} />
      </FieldRow>
      <FieldRow label="Show reading time">
        <Toggle value={settings.showReadingTime} onChange={(v) => set("showReadingTime", v)} />
      </FieldRow>
      <FieldRow label="Smart typography" hint="Auto-replace straight quotes, ellipses, em-dashes.">
        <Toggle value={settings.smartTypography} onChange={(v) => set("smartTypography", v)} />
      </FieldRow>
      <FieldRow label="Show invisibles" hint="Render whitespace, tabs and line breaks.">
        <Toggle value={settings.showInvisibles} onChange={(v) => set("showInvisibles", v)} />
      </FieldRow>
    </div>
  );
}

/* ─── Code blocks ──────────────────────────────────────────────────── */

function CodeSection({ settings, set }: SectionProps) {
  return (
    <div>
      <FieldRow label="Code theme" hint="Syntax highlighting palette.">
        <Select
          value={settings.codeTheme}
          onChange={(v) => set("codeTheme", v as AppSettings["codeTheme"])}
          options={[
            { value: "auto",        label: "Auto (match app theme)" },
            { value: "github-dark", label: "GitHub Dark" },
            { value: "monokai",     label: "Monokai" },
            { value: "dracula",     label: "Dracula" },
            { value: "nord",        label: "Nord" },
          ]}
        />
      </FieldRow>
      <FieldRow label="Code font size">
        <Slider
          value={settings.codeFontSize} min={11} max={20}
          onChange={(v) => set("codeFontSize", v)} suffix="px"
        />
      </FieldRow>
      <FieldRow label="Tab size">
        <Slider
          value={settings.codeTabSize} min={2} max={8}
          onChange={(v) => set("codeTabSize", v)}
        />
      </FieldRow>
      <FieldRow label="Wrap long lines">
        <Toggle value={settings.codeWrapLines} onChange={(v) => set("codeWrapLines", v)} />
      </FieldRow>
      <FieldRow label="Show line numbers">
        <Toggle value={settings.codeShowLineNumbers} onChange={(v) => set("codeShowLineNumbers", v)} />
      </FieldRow>
    </div>
  );
}

/* ─── Files ────────────────────────────────────────────────────────── */

function FilesSection({ settings, set }: SectionProps) {
  return (
    <div>
      <FieldRow label="Default note folder" hint="Relative to your vault. Empty = root.">
        <input
          type="text"
          value={settings.defaultNoteFolder}
          onChange={(e) => set("defaultNoteFolder", e.target.value)}
          placeholder="e.g. Inbox"
          className="bg-trevor-bg-elevated border border-trevor-border rounded px-2.5 py-1.5 text-[12.5px] text-trevor-text focus:border-trevor-accent outline-none min-w-[220px]"
        />
      </FieldRow>
      <FieldRow label="Attachments folder" hint="Where pasted images & files go.">
        <input
          type="text"
          value={settings.attachmentsFolder}
          onChange={(e) => set("attachmentsFolder", e.target.value)}
          placeholder="attachments"
          className="bg-trevor-bg-elevated border border-trevor-border rounded px-2.5 py-1.5 text-[12.5px] text-trevor-text focus:border-trevor-accent outline-none min-w-[220px]"
        />
      </FieldRow>
      <div className="py-3 border-b border-trevor-border-subtle">
        <div className="text-[13px] font-medium text-trevor-text mb-1">New note template</div>
        <p className="text-[11.5px] text-trevor-text-muted mb-2">
          Inserted into every new note.  Available variables:{" "}
          <code className="text-trevor-accent">{"{{date}}"}</code>{" "}
          <code className="text-trevor-accent">{"{{time}}"}</code>{" "}
          <code className="text-trevor-accent">{"{{title}}"}</code>
        </p>
        <textarea
          value={settings.newNoteTemplate}
          onChange={(e) => set("newNoteTemplate", e.target.value)}
          rows={5}
          placeholder={`# {{title}}\n\nCreated: {{date}}\n\n`}
          className="w-full bg-trevor-bg-elevated border border-trevor-border rounded px-3 py-2 text-[12.5px] text-trevor-text font-mono focus:border-trevor-accent outline-none resize-none"
        />
      </div>
    </div>
  );
}

/* ─── Privacy ──────────────────────────────────────────────────────── */

function PrivacySection({ settings, set }: SectionProps) {
  return (
    <div>
      <FieldRow label="Anonymous telemetry" hint="Trevor never collects telemetry. This switch is a placeholder for future opt-in analytics.">
        <Toggle value={settings.telemetry} onChange={(v) => set("telemetry", v)} />
      </FieldRow>
      <div className="mt-4 p-4 bg-trevor-bg-tertiary border border-trevor-border rounded-lg">
        <div className="text-[12.5px] text-trevor-text-secondary leading-relaxed">
          <strong className="text-trevor-text">Local-first by design.</strong>{" "}
          Your notes never leave your machine. Settings are stored in
          <code className="mx-1 text-trevor-accent">localStorage</code> under
          <code className="mx-1 text-trevor-accent">trevor.settings.v1</code>.
        </div>
      </div>
    </div>
  );
}
