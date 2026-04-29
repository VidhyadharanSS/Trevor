/**
 * Trevor — CodeMirror Code Block
 *
 * A read-only / interactive code viewer used inside the markdown preview.
 * Wraps CodeMirror 6 to provide language-aware syntax highlighting,
 * line numbers, copy-to-clipboard, and a language switcher.
 *
 * Highlight tokens are mapped to dedicated CSS classes so we can theme
 * comments, keywords, strings, etc. distinctly via the active Trevor
 * theme.  Comments in particular are rendered with a strongly-muted,
 * italic style so they stand out from executable code.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorView, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import {
  syntaxHighlighting,
  HighlightStyle,
  indentOnInput,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { history } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html as cmHtml } from "@codemirror/lang-html";
import { css as cmCss } from "@codemirror/lang-css";
import { json as cmJson } from "@codemirror/lang-json";
import { markdown as cmMarkdown } from "@codemirror/lang-markdown";
import { rust } from "@codemirror/lang-rust";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import { php } from "@codemirror/lang-php";
import { Copy, Check, ChevronDown } from "lucide-react";
import { useSettings } from "@/lib/settings/store";

/** Map of supported languages → CodeMirror extension factory. */
const LANGUAGES: Record<string, () => ReturnType<typeof javascript>> = {
  javascript: () => javascript({ jsx: true }),
  js: () => javascript({ jsx: true }),
  jsx: () => javascript({ jsx: true }),
  typescript: () => javascript({ jsx: true, typescript: true }),
  ts: () => javascript({ jsx: true, typescript: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  python: () => python(),
  py: () => python(),
  html: () => cmHtml(),
  css: () => cmCss(),
  json: () => cmJson(),
  markdown: () => cmMarkdown(),
  md: () => cmMarkdown(),
  rust: () => rust(),
  rs: () => rust(),
  cpp: () => cpp(),
  "c++": () => cpp(),
  c: () => cpp(),
  java: () => java(),
  sql: () => sql(),
  xml: () => xml(),
  yaml: () => yaml(),
  yml: () => yaml(),
  php: () => php(),
};

/** Display labels for the language picker. */
const LANGUAGE_LABELS: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  jsx: "JSX",
  tsx: "TSX",
  python: "Python",
  html: "HTML",
  css: "CSS",
  json: "JSON",
  markdown: "Markdown",
  rust: "Rust",
  cpp: "C++",
  c: "C",
  java: "Java",
  sql: "SQL",
  xml: "XML",
  yaml: "YAML",
  php: "PHP",
  bash: "Bash",
  shell: "Shell",
  zsh: "Zsh",
  go: "Go",
  text: "Plain Text",
};

const PICKER_LANGUAGES = [
  "text", "javascript", "typescript", "jsx", "tsx",
  "python", "html", "css", "json", "markdown",
  "rust", "go", "cpp", "c", "java",
  "sql", "xml", "yaml", "php", "bash",
];

/**
 * Trevor highlight style.  Tokens are mapped to CSS variables (with
 * sensible defaults) so each Trevor theme can re-tint syntax via its
 * `[data-theme]` rules.  Comments get a strongly distinct treatment.
 */
const trevorHighlightStyle = HighlightStyle.define([
  // Comments — italic, strongly muted, accent on doc-comment.
  { tag: t.comment,           class: "tok-comment" },
  { tag: t.lineComment,       class: "tok-comment" },
  { tag: t.blockComment,      class: "tok-comment" },
  { tag: t.docComment,        class: "tok-doc-comment" },

  // Keywords / control flow
  { tag: t.keyword,           class: "tok-keyword" },
  { tag: t.controlKeyword,    class: "tok-keyword" },
  { tag: t.modifier,          class: "tok-keyword" },
  { tag: t.operatorKeyword,   class: "tok-keyword" },
  { tag: t.definitionKeyword, class: "tok-keyword" },

  // Identifiers
  { tag: t.variableName,      class: "tok-variable" },
  { tag: t.propertyName,      class: "tok-property" },
  { tag: t.function(t.variableName), class: "tok-function" },
  { tag: t.function(t.propertyName), class: "tok-function" },
  { tag: t.definition(t.variableName), class: "tok-definition" },
  { tag: t.definition(t.function(t.variableName)), class: "tok-function-def" },
  { tag: t.className,         class: "tok-class" },
  { tag: t.typeName,           class: "tok-type" },
  { tag: t.namespace,          class: "tok-namespace" },

  // Literals
  { tag: t.string,             class: "tok-string" },
  { tag: t.special(t.string),  class: "tok-string-escape" },
  { tag: t.regexp,             class: "tok-regexp" },
  { tag: t.number,             class: "tok-number" },
  { tag: t.bool,               class: "tok-bool" },
  { tag: t.null,               class: "tok-null" },
  { tag: t.atom,               class: "tok-atom" },
  { tag: t.literal,            class: "tok-literal" },

  // Tags / attrs (for HTML / JSX / XML)
  { tag: t.tagName,            class: "tok-tag" },
  { tag: t.attributeName,      class: "tok-attr" },
  { tag: t.attributeValue,     class: "tok-string" },

  // Punctuation / operators
  { tag: t.operator,           class: "tok-operator" },
  { tag: t.punctuation,        class: "tok-punct" },
  { tag: t.bracket,            class: "tok-punct" },
  { tag: t.meta,               class: "tok-meta" },

  // Headings (for markdown)
  { tag: t.heading,            class: "tok-heading" },
  { tag: t.url,                class: "tok-link" },
  { tag: t.link,               class: "tok-link" },
  { tag: t.emphasis,           class: "tok-em" },
  { tag: t.strong,             class: "tok-strong" },
  { tag: t.strikethrough,      class: "tok-strike" },
]);

interface CodeBlockProps {
  code: string;
  language?: string;
  onLanguageChange?: (lang: string) => void;
}

export function CodeBlock({
  code,
  language = "text",
  onLanguageChange,
}: CodeBlockProps) {
  const settings = useSettings((s) => s.settings);
  const showLineNumbers = settings.codeShowLineNumbers;
  const wrapLines = settings.codeWrapLines;

  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const langCompartmentRef = useRef(new Compartment());
  const wrapCompartmentRef = useRef(new Compartment());
  const lineNumCompartmentRef = useRef(new Compartment());
  const [copied, setCopied] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeLang, setActiveLang] = useState(language.toLowerCase());

  const langExtension = useMemo(() => {
    const factory = LANGUAGES[activeLang];
    return factory ? factory() : null;
  }, [activeLang]);

  /** Mount + unmount CodeMirror exactly once. */
  useEffect(() => {
    if (!hostRef.current) return;

    const baseExtensions = [
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
      history(),
      indentOnInput(),
      syntaxHighlighting(trevorHighlightStyle, { fallback: true }),
      highlightActiveLine(),
      EditorView.theme({
        "&": { fontFamily: "var(--font-mono)" },
        ".cm-content": { padding: "12px 16px", caretColor: "transparent" },
        ".cm-line": { padding: "0 4px" },
      }),
      langCompartmentRef.current.of(langExtension ?? []),
      wrapCompartmentRef.current.of(wrapLines ? EditorView.lineWrapping : []),
      lineNumCompartmentRef.current.of(showLineNumbers ? lineNumbers() : []),
    ];

    const state = EditorState.create({
      doc: code,
      extensions: baseExtensions,
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Sync code prop → editor doc. */
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== code) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: code },
      });
    }
  }, [code]);

  /** Reconfigure language without recreating the editor. */
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: langCompartmentRef.current.reconfigure(langExtension ?? []),
    });
  }, [langExtension]);

  /** React to wrapLines / showLineNumbers from settings. */
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: wrapCompartmentRef.current.reconfigure(
        wrapLines ? EditorView.lineWrapping : [],
      ),
    });
  }, [wrapLines]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: lineNumCompartmentRef.current.reconfigure(
        showLineNumbers ? lineNumbers() : [],
      ),
    });
  }, [showLineNumbers]);

  /** Copy the raw code to clipboard. */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleSelectLang = (lang: string) => {
    setActiveLang(lang);
    setPickerOpen(false);
    onLanguageChange?.(lang);
  };

  // Outside-click for picker.
  useEffect(() => {
    if (!pickerOpen) return;
    function onPointerDown(e: PointerEvent) {
      const host = hostRef.current?.parentElement; // wrapper div
      if (!host) return;
      if (!host.contains(e.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [pickerOpen]);

  const displayLabel = LANGUAGE_LABELS[activeLang] ?? activeLang;

  return (
    <div className="my-4 rounded-lg border border-trevor-border overflow-hidden bg-trevor-bg-tertiary">
      {/* Header bar with language picker + copy */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-trevor-bg-secondary border-b border-trevor-border">
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-trevor-text-muted hover:text-trevor-text transition-colors"
          >
            {displayLabel}
            <ChevronDown size={12} />
          </button>
          {pickerOpen && (
            <div className="absolute z-30 mt-1 left-0 w-44 max-h-72 overflow-y-auto scrollbar-thin bg-trevor-bg-elevated border border-trevor-border rounded-md shadow-elevation-2 animate-fade-in">
              {PICKER_LANGUAGES.map((l) => (
                <button
                  key={l}
                  onClick={() => handleSelectLang(l)}
                  className={`block w-full text-left px-3 py-1.5 text-[12px] hover:bg-trevor-surface-hover transition-colors ${
                    activeLang === l ? "text-trevor-accent" : "text-trevor-text"
                  }`}
                >
                  {LANGUAGE_LABELS[l] ?? l}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-trevor-text-muted hover:text-trevor-text transition-colors px-2 py-0.5 rounded"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check size={12} className="text-trevor-success" /> Copied
            </>
          ) : (
            <>
              <Copy size={12} /> Copy
            </>
          )}
        </button>
      </div>

      {/* CodeMirror host */}
      <div ref={hostRef} className="trevor-cm-host" />
    </div>
  );
}
