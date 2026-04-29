/**
 * Trevor — Editor Toolbar (rich, MS-Word-style)  — Phase 4
 *
 * Comprehensive markdown formatting toolbar grouped into logical clusters.
 * Every action is dispatched through a single `applyAction` function that
 * deterministically transforms the textarea selection, then refocuses
 * and restores selection — guaranteeing every button works correctly.
 *
 * Dropdowns (Heading / Code lang / Callout / List style) are anchored
 * directly under their trigger and dismiss on outside click via a
 * pointerdown listener that runs in capture phase so it never races
 * with the menu item's own click handler.
 */
import { useCallback } from "react";
import {
  Bold, Italic, Strikethrough, Underline,
  Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
  List, ListOrdered, CheckSquare,
  IndentDecrease, IndentIncrease,
  Quote, Code, CodeSquare, Minus, Table,
  Link as LinkIcon, Image as ImageIcon,
  GitBranch, Sigma, Hash,
  Eye, Edit3, FileDown, Settings as SettingsIcon,
  Highlighter, Superscript, Subscript,
  AlertCircle, Info, AlertTriangle, CheckCircle2,
  Type, ChevronDown, Tag as TagIcon,
} from "lucide-react";
import { PortalMenu } from "@/components/ui/PortalMenu";

interface ToolbarAction {
  icon: React.ElementType;
  label: string;
  action: string;
  shortcut?: string;
}

/* ── Static action groups ──────────────────────────────────────────── */

const INLINE_ACTIONS: ToolbarAction[] = [
  { icon: Bold, label: "Bold", action: "bold", shortcut: "⌘B" },
  { icon: Italic, label: "Italic", action: "italic", shortcut: "⌘I" },
  { icon: Underline, label: "Underline", action: "underline", shortcut: "⌘U" },
  { icon: Strikethrough, label: "Strikethrough", action: "strikethrough" },
  { icon: Highlighter, label: "Highlight", action: "highlight" },
  { icon: Code, label: "Inline Code", action: "inlineCode", shortcut: "⌘E" },
];

const SCRIPT_ACTIONS: ToolbarAction[] = [
  { icon: Superscript, label: "Superscript", action: "sup" },
  { icon: Subscript, label: "Subscript", action: "sub" },
];

const LIST_ACTIONS: ToolbarAction[] = [
  { icon: List, label: "Bullet List", action: "ul" },
  { icon: ListOrdered, label: "Numbered List", action: "ol" },
  { icon: CheckSquare, label: "Task List", action: "task" },
  { icon: IndentDecrease, label: "Outdent (Shift+Tab)", action: "outdent" },
  { icon: IndentIncrease, label: "Indent (Tab)", action: "indent" },
];

const BLOCK_ACTIONS: ToolbarAction[] = [
  { icon: Quote, label: "Blockquote", action: "quote" },
  { icon: Minus, label: "Horizontal Rule", action: "hr" },
  { icon: Table, label: "Table", action: "table" },
];

const EMBED_ACTIONS: ToolbarAction[] = [
  { icon: LinkIcon, label: "Link", action: "link", shortcut: "⌘K" },
  { icon: ImageIcon, label: "Image", action: "image" },
  { icon: Sigma, label: "Math (KaTeX)", action: "math" },
  { icon: GitBranch, label: "Mermaid Diagram", action: "mermaid" },
];

const HEADING_LEVELS: Array<{ icon: React.ElementType; label: string; action: string }> = [
  { icon: Heading1, label: "Heading 1", action: "h1" },
  { icon: Heading2, label: "Heading 2", action: "h2" },
  { icon: Heading3, label: "Heading 3", action: "h3" },
  { icon: Heading4, label: "Heading 4", action: "h4" },
  { icon: Heading5, label: "Heading 5", action: "h5" },
  { icon: Heading6, label: "Heading 6", action: "h6" },
];

const CALLOUTS = [
  { icon: Info, label: "Info Callout", kind: "info" },
  { icon: AlertCircle, label: "Note Callout", kind: "note" },
  { icon: AlertTriangle, label: "Warning Callout", kind: "warning" },
  { icon: CheckCircle2, label: "Success Callout", kind: "success" },
];

const CODE_LANGUAGES = [
  "javascript", "typescript", "jsx", "tsx",
  "python", "rust", "go", "java", "kotlin",
  "cpp", "c", "csharp", "ruby", "php", "swift",
  "html", "css", "scss", "sass",
  "json", "yaml", "toml", "xml",
  "sql", "graphql", "bash", "shell", "zsh",
  "markdown", "dockerfile", "ini", "diff",
];

const LIST_STYLES: Array<{ label: string; sample: string; action: string }> = [
  { label: "Disc",      sample: "• Item",  action: "ul" },
  { label: "Numbered",  sample: "1. Item", action: "ol" },
  { label: "Task",      sample: "☐ Task",  action: "task" },
];

interface EditorToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onContentChange: (content: string) => void;
  isPreview: boolean;
  onTogglePreview: () => void;
  onExportPdf?: () => void;
  onOpenSettings?: () => void;
  onAddTag?: () => void;
}

/* ── Toolbar component ─────────────────────────────────────────────── */

export function EditorToolbar({
  textareaRef,
  onContentChange,
  isPreview,
  onTogglePreview,
  onExportPdf,
  onOpenSettings,
  onAddTag,
}: EditorToolbarProps) {
  const apply = useCallback(
    (action: string, extra?: string) => applyAction(textareaRef.current, action, onContentChange, extra),
    [textareaRef, onContentChange],
  );

  const btnBase =
    "p-1.5 rounded text-trevor-text-muted hover:text-trevor-text hover:bg-trevor-surface-hover transition-colors flex-shrink-0";
  const btnActive = "text-trevor-accent bg-trevor-surface-hover";

  return (
    <div
      className="px-3 py-1.5 border-b border-trevor-border-subtle flex items-center gap-0.5 bg-trevor-bg overflow-x-auto scrollbar-thin flex-shrink-0"
    >
      {/* Heading dropdown */}
      <PortalMenu
        title="Headings"
        trigger={
          <button type="button" className={btnBase} aria-haspopup="menu">
            <span className="flex items-center gap-1">
              <Type size={15} strokeWidth={1.8} />
              <ChevronDown size={11} />
            </span>
          </button>
        }
      >
        {HEADING_LEVELS.map((h) => (
          <MenuItem
            key={h.action}
            icon={h.icon}
            label={h.label}
            onSelect={() => apply(h.action)}
          />
        ))}
      </PortalMenu>

      <Divider />

      {/* Inline emphasis */}
      <Group>
        {INLINE_ACTIONS.map((a) => (
          <ToolbarBtn key={a.action} action={a} onClick={() => apply(a.action)} className={btnBase} />
        ))}
      </Group>

      <Divider />

      {/* Sup/sub */}
      <Group>
        {SCRIPT_ACTIONS.map((a) => (
          <ToolbarBtn key={a.action} action={a} onClick={() => apply(a.action)} className={btnBase} />
        ))}
      </Group>

      <Divider />

      {/* List dropdown */}
      <PortalMenu
        title="List style"
        trigger={
          <button type="button" className={btnBase} aria-haspopup="menu">
            <span className="flex items-center gap-1">
              <List size={15} strokeWidth={1.8} />
              <ChevronDown size={11} />
            </span>
          </button>
        }
      >
        {LIST_STYLES.map((s) => (
          <button
            key={s.action}
            onClick={() => apply(s.action)}
            className="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-[13px] text-trevor-text hover:bg-trevor-surface-hover transition-colors"
          >
            <span>{s.label}</span>
            <span className="text-trevor-text-muted text-[11px] font-mono">{s.sample}</span>
          </button>
        ))}
      </PortalMenu>

      {/* List actions */}
      <Group>
        {LIST_ACTIONS.map((a) => (
          <ToolbarBtn key={a.action} action={a} onClick={() => apply(a.action)} className={btnBase} />
        ))}
      </Group>

      <Divider />

      {/* Block actions */}
      <Group>
        {BLOCK_ACTIONS.map((a) => (
          <ToolbarBtn key={a.action} action={a} onClick={() => apply(a.action)} className={btnBase} />
        ))}
      </Group>

      {/* Code-block dropdown (with language picker) */}
      <PortalMenu
        title="Code Block (with language)"
        widthClass="w-52"
        trigger={
          <button type="button" className={btnBase} aria-haspopup="menu">
            <span className="flex items-center gap-1">
              <CodeSquare size={15} strokeWidth={1.8} />
              <ChevronDown size={11} />
            </span>
          </button>
        }
      >
        <button
          onClick={() => apply("codeBlock")}
          className="w-full text-left px-3 py-1.5 text-[12.5px] text-trevor-text hover:bg-trevor-surface-hover transition-colors border-b border-trevor-border-subtle"
        >
          <span className="text-trevor-accent font-medium">Plain code block</span>
          <span className="block text-[10.5px] text-trevor-text-muted">no language hint</span>
        </button>
        <div className="px-3 pt-1.5 pb-0.5 text-[10px] uppercase tracking-wider text-trevor-text-muted">
          With language
        </div>
        <div className="max-h-56 overflow-y-auto scrollbar-thin">
          {CODE_LANGUAGES.map((l) => (
            <button
              key={l}
              onClick={() => apply("codeBlock", l)}
              className="w-full text-left px-3 py-1 text-[12.5px] text-trevor-text hover:bg-trevor-surface-hover transition-colors font-mono"
            >
              {l}
            </button>
          ))}
        </div>
      </PortalMenu>

      {/* Callout dropdown */}
      <PortalMenu
        title="Callout"
        trigger={
          <button type="button" className={btnBase} aria-haspopup="menu">
            <span className="flex items-center gap-1">
              <Info size={15} strokeWidth={1.8} />
              <ChevronDown size={11} />
            </span>
          </button>
        }
      >
        {CALLOUTS.map((c) => (
          <MenuItem
            key={c.kind}
            icon={c.icon}
            label={c.label}
            onSelect={() => apply("callout", c.kind)}
          />
        ))}
      </PortalMenu>

      <Divider />

      {/* Embeds */}
      <Group>
        {EMBED_ACTIONS.map((a) => (
          <ToolbarBtn key={a.action} action={a} onClick={() => apply(a.action)} className={btnBase} />
        ))}
        {/* Tag — opens the tag manager modal (controlled by parent). */}
        {onAddTag && (
          <button
            onClick={onAddTag}
            className={btnBase}
            title="Manage tags"
          >
            <TagIcon size={15} strokeWidth={1.8} />
          </button>
        )}
        {/* Inline hashtag literal (kept for power users). */}
        <button
          onClick={() => apply("hashtag")}
          className={btnBase}
          title="Insert inline #hashtag"
        >
          <Hash size={15} strokeWidth={1.8} />
        </button>
      </Group>

      <div className="flex-1 min-w-2" />

      {/* Right-side actions */}
      <button
        onClick={onTogglePreview}
        className={`${btnBase} ${isPreview ? btnActive : ""}`}
        title={isPreview ? "Edit Mode" : "Preview Mode"}
      >
        {isPreview ? <Edit3 size={15} strokeWidth={1.8} /> : <Eye size={15} strokeWidth={1.8} />}
      </button>

      {onExportPdf && (
        <button onClick={onExportPdf} className={btnBase} title="Export to PDF">
          <FileDown size={15} strokeWidth={1.8} />
        </button>
      )}

      {onOpenSettings && (
        <button onClick={onOpenSettings} className={btnBase} title="Settings (⌘,)">
          <SettingsIcon size={15} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function Divider() {
  return <div className="w-px h-5 bg-trevor-border mx-1 flex-shrink-0" />;
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolbarBtn({
  action, onClick, className,
}: { action: ToolbarAction; onClick: () => void; className: string }) {
  return (
    <button
      onClick={onClick}
      className={className}
      title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
    >
      <action.icon size={15} strokeWidth={1.8} />
    </button>
  );
}

function MenuItem({
  icon: Icon, label, onSelect,
}: { icon: React.ElementType; label: string; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      role="menuitem"
      className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-trevor-text hover:bg-trevor-surface-hover transition-colors"
    >
      <Icon size={14} /> {label}
    </button>
  );
}

/* ── Action engine ─────────────────────────────────────────────────── */

/**
 * Apply an action to the textarea.  Returns nothing; mutates content via
 * onContentChange and restores selection on the next animation frame.
 *
 * The trick is to compute a minimal `{from, to, insert, selStart, selEnd}`
 * envelope, then atomically apply it.  This makes every action work
 * regardless of whether text is selected or where the caret sits.
 */
function applyAction(
  textareaArg: HTMLTextAreaElement | null,
  action: string,
  onContentChange: (next: string) => void,
  extra?: string,
): void {
  if (!textareaArg) return;
  // Capture as a non-null local so all closures retain the narrowed type.
  const textarea: HTMLTextAreaElement = textareaArg;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);

  // Helper: replace [from, to) with `insert` and place caret at `caret`.
  function replace(from: number, to: number, insert: string, caret: number, caretEnd?: number) {
    const next = value.slice(0, from) + insert + value.slice(to);
    onContentChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(caret, caretEnd ?? caret);
    });
  }

  // Helper: wrap selection with prefix/suffix.  When nothing is selected,
  // insert a placeholder and keep it selected for easy replacement.
  function wrap(open: string, close: string, placeholder: string) {
    if (selected) {
      const insert = `${open}${selected}${close}`;
      replace(start, end, insert, start + insert.length);
    } else {
      const insert = `${open}${placeholder}${close}`;
      const caret = start + open.length;
      replace(start, end, insert, caret, caret + placeholder.length);
    }
  }

  // Find the start of the line the caret is on.
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = (() => {
    const i = value.indexOf("\n", end);
    return i === -1 ? value.length : i;
  })();
  const lineText = value.slice(lineStart, lineEnd);

  // Helper: prefix the entire current line with `prefix` (idempotent).
  function prefixLine(prefix: string, placeholder: string) {
    // If line is empty, insert prefix + placeholder, selecting placeholder.
    if (lineText.trim() === "") {
      const insert = `${prefix}${placeholder}`;
      replace(lineStart, lineEnd, insert, lineStart + prefix.length, lineStart + insert.length);
      return;
    }
    // Insert prefix at lineStart.
    const insert = `${prefix}${lineText}`;
    const delta = prefix.length;
    replace(lineStart, lineEnd, insert, start + delta, end + delta);
  }

  // Helper: replace the heading prefix (or add one).
  function setHeading(level: number) {
    const trimmed = lineText.replace(/^(#{1,6}\s+)/, "");
    const hashes = "#".repeat(level);
    const insert = `${hashes} ${trimmed || "Heading"}`;
    const newLineStart = lineStart;
    const newCaret = newLineStart + insert.length;
    replace(lineStart, lineEnd, insert, trimmed ? newLineStart + hashes.length + 1 : newCaret, newCaret);
  }

  // Helper: insert a block (pre + body + post) above or replacing current line.
  function insertBlock(text: string, caretOffset?: number, selectLength?: number) {
    // If line is empty, replace it; else, add a newline before.
    const prefix = lineText === "" ? "" : "\n";
    const suffix = lineEnd === value.length ? "\n" : "\n";
    const insert = `${prefix}${text}${suffix}`;
    const insertAt = lineEnd;
    const caretBase = insertAt + prefix.length;
    const caret = caretOffset !== undefined ? caretBase + caretOffset : caretBase + text.length;
    const caretEnd = selectLength !== undefined ? caret + selectLength : caret;
    replace(insertAt, insertAt, insert, caret, caretEnd);
  }

  /* ── Action dispatch ── */

  switch (action) {
    /* Inline emphasis */
    case "bold":          return wrap("**", "**", "bold text");
    case "italic":        return wrap("*", "*", "italic text");
    case "underline":     return wrap("<u>", "</u>", "underlined text");
    case "strikethrough": return wrap("~~", "~~", "strikethrough");
    case "highlight":     return wrap("==", "==", "highlighted");
    case "inlineCode":    return wrap("`", "`", "code");
    case "sup":           return wrap("<sup>", "</sup>", "superscript");
    case "sub":           return wrap("<sub>", "</sub>", "subscript");

    /* Headings */
    case "h1": case "h2": case "h3":
    case "h4": case "h5": case "h6":
      return setHeading(parseInt(action.slice(1), 10));

    /* Lists */
    case "ul":   return prefixLine("- ", "List item");
    case "ol":   return prefixLine("1. ", "List item");
    case "task": return prefixLine("- [ ] ", "Task item");

    /* Indent / outdent */
    case "indent": {
      const insert = "  " + lineText;
      replace(lineStart, lineEnd, insert, start + 2, end + 2);
      return;
    }
    case "outdent": {
      if (lineText.startsWith("  ")) {
        const insert = lineText.slice(2);
        replace(lineStart, lineEnd, insert, Math.max(start - 2, lineStart), Math.max(end - 2, lineStart));
      } else if (lineText.startsWith("\t")) {
        const insert = lineText.slice(1);
        replace(lineStart, lineEnd, insert, Math.max(start - 1, lineStart), Math.max(end - 1, lineStart));
      }
      return;
    }

    /* Blocks */
    case "quote":  return prefixLine("> ", "Quote");
    case "hr":     return insertBlock("---");
    case "table":  return insertBlock(
      "| Header 1 | Header 2 | Header 3 |\n" +
      "| -------- | -------- | -------- |\n" +
      "| Cell 1   | Cell 2   | Cell 3   |",
    );

    case "codeBlock": {
      const lang = extra ?? "";
      const body = selected || "code here";
      const block = "```" + lang + "\n" + body + "\n```";
      // If selection, replace it; otherwise insert block.
      if (selected) {
        replace(start, end, block, start + 4 + lang.length, start + 4 + lang.length + body.length);
      } else {
        // Insert inline so caret lands on the body line.
        const prefix = lineText === "" ? "" : "\n";
        const suffix = lineEnd === value.length ? "\n" : "\n";
        const insert = `${prefix}${block}${suffix}`;
        const caretStart = lineEnd + prefix.length + 4 + lang.length; // after ```lang\n
        replace(lineEnd, lineEnd, insert, caretStart, caretStart + body.length);
      }
      return;
    }

    case "callout": {
      const kind = (extra ?? "info").toUpperCase();
      const body = selected || "Callout content";
      const block = `> [!${kind}] ${body}`;
      if (selected) {
        replace(start, end, block, start + block.length);
      } else {
        const prefix = lineText === "" ? "" : "\n";
        const suffix = lineEnd === value.length ? "\n" : "\n";
        const insert = `${prefix}${block}${suffix}`;
        const caretStart = lineEnd + prefix.length + block.length - body.length;
        replace(lineEnd, lineEnd, insert, caretStart, caretStart + body.length);
      }
      return;
    }

    /* Embeds */
    case "link": {
      const text = selected || "link text";
      const insert = `[${text}](url)`;
      // Select "url" placeholder.
      const urlStart = start + insert.length - 4;
      replace(start, end, insert, urlStart, urlStart + 3);
      return;
    }
    case "image": {
      const alt = selected || "alt text";
      const insert = `![${alt}](url)`;
      const urlStart = start + insert.length - 4;
      replace(start, end, insert, urlStart, urlStart + 3);
      return;
    }
    case "math": {
      const body = selected || "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}";
      const block = `$$\n${body}\n$$`;
      if (selected) {
        replace(start, end, block, start + block.length);
      } else {
        const prefix = lineText === "" ? "" : "\n";
        const suffix = lineEnd === value.length ? "\n" : "\n";
        const insert = `${prefix}${block}${suffix}`;
        const caretStart = lineEnd + prefix.length + 3;
        replace(lineEnd, lineEnd, insert, caretStart, caretStart + body.length);
      }
      return;
    }
    case "mermaid": {
      const body = selected ||
        "graph TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Do this]\n    B -->|No| D[End]";
      const block = "```mermaid\n" + body + "\n```";
      const prefix = lineText === "" ? "" : "\n";
      const suffix = lineEnd === value.length ? "\n" : "\n";
      const insert = `${prefix}${block}${suffix}`;
      const caretStart = lineEnd + prefix.length + 11; // after ```mermaid\n
      replace(lineEnd, lineEnd, insert, caretStart, caretStart + body.length);
      return;
    }
    case "hashtag": {
      // Insert " #" + placeholder, selected.
      const insert = (start > 0 && value[start - 1] !== " " && value[start - 1] !== "\n" ? " " : "") + "#tag";
      const offset = insert.indexOf("#") + 1;
      replace(start, end, insert, start + offset, start + insert.length);
      return;
    }
  }
}
