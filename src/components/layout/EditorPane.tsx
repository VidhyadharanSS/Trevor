/**
 * Trevor — Editor Pane (Right Pane) — Phase 5
 *
 * Full markdown editor:
 *   • Live preview with Mermaid + CodeMirror code blocks
 *   • Rich formatting toolbar (heading dropdown, language picker, callouts)
 *   • Debounced auto-save (delay configurable in settings)
 *   • Word count + reading time + character count
 *   • Keyboard shortcuts (⌘B / ⌘I / ⌘K / ⌘S / ⌘F / Tab)
 *   • Find-in-note overlay (⌘F)
 *   • Snippet expansion (`:trigger` + Tab)
 *   • PDF export (system print dialog)
 *   • Wiki-link & tag click navigation
 *   • Editor typography fully driven by the settings store
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pen, FileText, Hash, Clock, Type as TypeIcon, Tag as TagIcon, Plus } from "lucide-react";
import { useVault } from "@/lib/store";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { MarkdownPreview } from "@/components/editor/MarkdownPreview";
import { FindInNote } from "@/components/editor/FindInNote";
import { noteTitle } from "@/lib/fs";
import { useSettings } from "@/lib/settings/store";
import { extractDeclaredTags, removeDeclaredTag } from "@/lib/tags";
import { useSnippets, expandSnippet, findByTrigger } from "@/lib/snippets/store";

interface EditorPaneProps {
  onSave: (content: string) => void;
  onWikiLinkClick?: (linkName: string) => void;
  onTagClick?: (tag: string) => void;
  onOpenSettings?: () => void;
  onOpenTagManager?: () => void;
  /** Imperatively jump the textarea to a given line (1-based). */
  jumpToLineRef?: React.MutableRefObject<((line: number) => void) | null>;
  /** Optional override for the rendered content (used to "preview" history). */
  previewOverride?: string | null;
  /** Notification when the user dismisses the preview override. */
  onClearPreviewOverride?: () => void;
  /** External PDF export hook (uses the polished print template). */
  onExportPdf?: () => void;
  /** When set, the file changed on disk to this content (external editor). */
  externalChangeContent?: string | null;
  /** Replace the in-memory buffer with the disk content. */
  onAcceptExternalChange?: () => void;
  /** Dismiss the external-change banner without reloading. */
  onDismissExternalChange?: () => void;
}

export function EditorPane({
  onSave, onWikiLinkClick, onTagClick, onOpenSettings, onOpenTagManager,
  jumpToLineRef, previewOverride, onClearPreviewOverride, onExportPdf,
  externalChangeContent, onAcceptExternalChange, onDismissExternalChange,
}: EditorPaneProps) {
  const { state, dispatch } = useVault();
  const { activeNotePath, activeNoteContent } = state;
  const settings = useSettings((s) => s.settings);
  const snippets = useSnippets((s) => s.snippets);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [isPreview, setIsPreview] = useState(
    settings.defaultEditorMode === "preview",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [findOpen, setFindOpen] = useState(false);

  // Auto-focus + reset preview state when note changes.
  useEffect(() => {
    if (activeNotePath && textareaRef.current && !isPreview) {
      textareaRef.current.focus();
    }
    // Default to user-preferred mode when opening a new note.
    setIsPreview(settings.defaultEditorMode === "preview");
    setFindOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNotePath]);

  /** Update content + schedule auto-save. */
  const handleContentChange = useCallback(
    (newContent: string) => {
      dispatch({ type: "UPDATE_NOTE_CONTENT", content: newContent });
      if (!settings.autoSave) return;
      setIsSaving(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        onSave(newContent);
        setIsSaving(false);
        setLastSaved(new Date());
      }, settings.autoSaveDelay);
    },
    [dispatch, onSave, settings.autoSave, settings.autoSaveDelay],
  );

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleContentChange(e.target.value);
    },
    [handleContentChange],
  );

  /** Try to expand a snippet ending at the caret.  Returns true if expanded.
   *  Skips when caret is inside a fenced code block so `:trigger` literals
   *  inside code samples (e.g. ratios in YAML) are never mangled. */
  const tryExpandSnippet = useCallback((): boolean => {
    const ta = textareaRef.current;
    if (!ta) return false;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start !== end) return false; // Only when no selection.
    const value = ta.value;
    // Skip if we're inside a fenced ``` code block.
    const fenceCount = (value.slice(0, start).match(/^```/gm) ?? []).length;
    if (fenceCount % 2 === 1) return false;
    // Find the trigger word ending at caret: a `:` followed by [\w-]+
    const before = value.slice(0, start);
    const m = before.match(/(:[A-Za-z][\w-]*)$/);
    if (!m) return false;
    const trigger = m[1];
    const snippet = findByTrigger(snippets, trigger);
    if (!snippet) return false;

    const title = activeNotePath ? noteTitle(activeNotePath) : "";
    const { text, cursorOffset } = expandSnippet(snippet.body, { title });
    const triggerStart = start - trigger.length;
    const next = value.slice(0, triggerStart) + text + value.slice(end);
    handleContentChange(next);
    requestAnimationFrame(() => {
      const ta2 = textareaRef.current;
      if (!ta2) return;
      const caret = cursorOffset != null ? triggerStart + cursorOffset : triggerStart + text.length;
      ta2.focus();
      ta2.setSelectionRange(caret, caret);
    });
    return true;
  }, [snippets, activeNotePath, handleContentChange]);

  /** Keyboard shortcuts. */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      const { selectionStart: start, selectionEnd: end, value } = textarea;
      const meta = e.metaKey || e.ctrlKey;

      // Bold
      if (meta && e.key.toLowerCase() === "b") {
        e.preventDefault();
        wrapSelection("**", "**", "bold text");
        return;
      }
      // Italic
      if (meta && e.key.toLowerCase() === "i") {
        e.preventDefault();
        wrapSelection("*", "*", "italic text");
        return;
      }
      // Underline
      if (meta && e.key.toLowerCase() === "u") {
        e.preventDefault();
        wrapSelection("<u>", "</u>", "underlined text");
        return;
      }
      // Inline code
      if (meta && e.key.toLowerCase() === "e") {
        e.preventDefault();
        wrapSelection("`", "`", "code");
        return;
      }
      // Find in note
      if (meta && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindOpen(true);
        return;
      }
      // Link
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const selected = value.substring(start, end) || "link text";
        const replacement = `[${selected}](url)`;
        const newContent = value.substring(0, start) + replacement + value.substring(end);
        handleContentChange(newContent);
        requestAnimationFrame(() => {
          const cursor = start + replacement.length - 4;
          textarea.setSelectionRange(cursor, cursor + 3);
        });
        return;
      }
      // Save now
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        onSave(value);
        setIsSaving(false);
        setLastSaved(new Date());
        return;
      }
      // Tab → snippet expansion if applicable, else indent
      if (e.key === "Tab" && !e.shiftKey) {
        if (tryExpandSnippet()) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        const newContent = value.substring(0, start) + "  " + value.substring(end);
        handleContentChange(newContent);
        requestAnimationFrame(() => textarea.setSelectionRange(start + 2, start + 2));
        return;
      }

      function wrapSelection(open: string, close: string, placeholder: string) {
        const selected = value.substring(start, end);
        const replacement = selected ? `${open}${selected}${close}` : `${open}${placeholder}${close}`;
        const newContent = value.substring(0, start) + replacement + value.substring(end);
        handleContentChange(newContent);
        requestAnimationFrame(() => {
          textarea.focus();
          if (selected) {
            const pos = start + replacement.length;
            textarea.setSelectionRange(pos, pos);
          } else {
            textarea.setSelectionRange(start + open.length, start + open.length + placeholder.length);
          }
        });
      }
    },
    [handleContentChange, onSave, tryExpandSnippet],
  );

  // Cleanup auto-save timer on unmount.
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Track whether the buffer is dirty (a save is queued/pending) — used
  // by the beforeunload guard to warn before closing the window with
  // unflushed edits.
  const dirtyRef = useRef(false);
  useEffect(() => { dirtyRef.current = isSaving; }, [isSaving]);
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
      // Modern browsers ignore the message but require a non-empty
      // returnValue to display the confirmation prompt.
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Imperative jump-to-line for outline clicks.
  useEffect(() => {
    if (!jumpToLineRef) return;
    jumpToLineRef.current = (line: number) => {
      const ta = textareaRef.current;
      if (!ta) return;
      // If preview, switch to source first.
      if (isPreview) setIsPreview(false);
      const lines = ta.value.split("\n");
      let offset = 0;
      for (let i = 0; i < Math.min(line, lines.length); i++) {
        offset += lines[i].length + 1;
      }
      requestAnimationFrame(() => {
        const ta2 = textareaRef.current;
        if (!ta2) return;
        ta2.focus();
        ta2.setSelectionRange(offset, offset);
        const lh = parseFloat(getComputedStyle(ta2).lineHeight) || 24;
        ta2.scrollTop = Math.max(0, line * lh - ta2.clientHeight / 2);
      });
    };
    return () => {
      if (jumpToLineRef) jumpToLineRef.current = null;
    };
  }, [jumpToLineRef, isPreview]);

  // Stats.
  const wordCount = activeNoteContent
    ? activeNoteContent.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const charCount = activeNoteContent.length;
  const readingMinutes = Math.max(1, Math.round(wordCount / 220));

  /**
   * PDF export. Prefers the polished, settings-aware print template
   * passed in from AppLayout via `onExportPdf`. Falls back to opening
   * the browser print dialog on the rendered preview if the prop is
   * absent (defensive — should never happen in production).
   */
  const handleExportPdf = useCallback(() => {
    if (onExportPdf) { onExportPdf(); return; }
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const title = activeNotePath ? noteTitle(activeNotePath) : "Note";
    const renderedHtml =
      document.querySelector(".markdown-preview")?.innerHTML ??
      "<p>Switch to preview mode before exporting.</p>";
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>body{font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif;max-width:760px;margin:0 auto;padding:40px 20px;color:#1a1a1a;line-height:1.7;font-size:15px}@media print{body{padding:0}pre{break-inside:avoid}}</style>
      </head><body>${renderedHtml}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 400);
  }, [activeNotePath, onExportPdf]);

  const togglePreview = useCallback(() => setIsPreview((p) => !p), []);

  const formatSaveTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // Empty state.
  if (!activeNotePath) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-trevor-bg min-w-0">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-trevor-bg-tertiary flex items-center justify-center mx-auto mb-4">
            <Pen size={24} className="text-trevor-text-muted" />
          </div>
          <h2 className="text-lg font-medium text-trevor-text-secondary mb-1">
            Select a note
          </h2>
          <p className="text-[13px] text-trevor-text-muted max-w-[260px]">
            Choose a note from the list, or press{" "}
            <kbd className="px-1.5 py-0.5 mx-1 bg-trevor-surface rounded text-[11px]">⌘K</kbd>{" "}
            to search and create.
          </p>
        </div>
      </div>
    );
  }

  const title = noteTitle(activeNotePath);
  const editorMaxWidth = settings.editorMaxWidth > 0
    ? `${settings.editorMaxWidth}px`
    : "100%";
  const displayContent = previewOverride ?? activeNoteContent;
  const isOverridden = previewOverride != null;

  return (
    <div className="flex-1 h-full flex flex-col bg-trevor-bg min-w-0 relative">
      {/* Header */}
      <div className="h-[52px] flex items-end px-6 pb-2 border-b border-trevor-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText size={14} className="text-trevor-text-muted flex-shrink-0" />
          <h2 className="text-[14px] font-medium text-trevor-text truncate">{title}</h2>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-trevor-text-muted flex-shrink-0">
          {isSaving && <span className="text-trevor-warning">Saving…</span>}
          {!isSaving && lastSaved && (
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {formatSaveTime(lastSaved)}
            </span>
          )}
        </div>
      </div>

      {/* Read-only preview banner when previewing a history version. */}
      {isOverridden && (
        <div className="px-6 py-1.5 bg-trevor-warning/15 border-b border-trevor-warning/30 text-[11.5px] text-trevor-warning flex items-center justify-between flex-shrink-0">
          <span>Previewing an earlier version (read-only). Changes won't be saved.</span>
          <button
            onClick={onClearPreviewOverride}
            className="text-[11px] hover:underline"
          >
            Back to current ✕
          </button>
        </div>
      )}

      {/* External-change banner — surfaces when the file was modified
          on disk by another process and the in-memory buffer diverged. */}
      {externalChangeContent != null && !isOverridden && (
        <div className="px-6 py-1.5 bg-trevor-info/15 border-b border-trevor-info/30 text-[11.5px] text-trevor-info flex items-center justify-between gap-3 flex-shrink-0">
          <span className="truncate">
            This note changed on disk. Reload to discard your unsaved edits and use the disk version?
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onAcceptExternalChange}
              className="text-[11px] px-2 py-0.5 rounded bg-trevor-info/20 hover:bg-trevor-info/30 transition-colors"
            >
              Reload from disk
            </button>
            <button
              onClick={onDismissExternalChange}
              className="text-[11px] hover:underline"
              title="Keep my edits — next save will overwrite the disk version"
            >
              Keep mine ✕
            </button>
          </div>
        </div>
      )}

      {/* Toolbar — top position (default). Hidden if user disabled it
          in Settings → Editor, or if they moved it to the bottom. */}
      {settings.showEditorToolbar && settings.editorToolbarPosition === "top" && (
        <EditorToolbar
          textareaRef={textareaRef}
          onContentChange={handleContentChange}
          isPreview={isPreview}
          onTogglePreview={togglePreview}
          onExportPdf={handleExportPdf}
          onOpenSettings={onOpenSettings}
          onAddTag={onOpenTagManager}
        />
      )}

      {/* Declared tag chips strip — visible in both source and preview mode. */}
      <DeclaredTagStrip
        content={activeNoteContent}
        onChange={(next) => {
          dispatch({ type: "UPDATE_NOTE_CONTENT", content: next });
          onSave(next);
        }}
        onAddTag={onOpenTagManager}
      />

      {/* Editor or Preview */}
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 relative">
        {/* Find-in-note overlay (only in source mode). */}
        {!isPreview && (
          <FindInNote
            textareaRef={textareaRef}
            open={findOpen}
            onClose={() => setFindOpen(false)}
            content={activeNoteContent}
          />
        )}
        {isPreview || isOverridden ? (
          <div className="px-8 py-6 mx-auto" style={{ maxWidth: editorMaxWidth }}>
            <MarkdownPreview
              content={displayContent}
              onWikiLinkClick={onWikiLinkClick}
              onTagClick={onTagClick}
            />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={activeNoteContent}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            className="w-full h-full resize-none outline-none bg-transparent text-trevor-text editor-content placeholder:text-trevor-text-muted block mx-auto px-8 py-6"
            style={{
              fontFamily: "var(--font-editor)",
              fontSize: "var(--editor-font-size)",
              lineHeight: "var(--editor-line-height)",
              maxWidth: editorMaxWidth,
            }}
            placeholder="Start writing… (try :date + Tab)"
            spellCheck={settings.spellCheck}
          />
        )}
      </div>

      {/* Toolbar — bottom position (when user opted in via settings). */}
      {settings.showEditorToolbar && settings.editorToolbarPosition === "bottom" && (
        <EditorToolbar
          textareaRef={textareaRef}
          onContentChange={handleContentChange}
          isPreview={isPreview}
          onTogglePreview={togglePreview}
          onExportPdf={handleExportPdf}
          onOpenSettings={onOpenSettings}
          onAddTag={onOpenTagManager}
        />
      )}

      {/* Status bar */}
      <div className="h-7 flex items-center justify-between px-6 border-t border-trevor-border-subtle text-[11px] text-trevor-text-muted flex-shrink-0 bg-trevor-bg">
        <div className="flex items-center gap-4">
          {settings.showWordCount && (
            <span className="flex items-center gap-1">
              <TypeIcon size={10} /> {wordCount} word{wordCount === 1 ? "" : "s"}
            </span>
          )}
          <span>
            <Hash size={10} className="inline mr-0.5" />
            {charCount} char{charCount === 1 ? "" : "s"}
          </span>
          {settings.showReadingTime && wordCount > 0 && (
            <span>~ {readingMinutes} min read</span>
          )}
        </div>
        <span>{isOverridden ? "History preview" : isPreview ? "Preview" : "Markdown"}</span>
      </div>
    </div>
  );
}

/** Chip strip — declared tags from the note's frontmatter, with quick remove + add. */
function DeclaredTagStrip({
  content,
  onChange,
  onAddTag,
}: {
  content: string;
  onChange: (next: string) => void;
  onAddTag?: () => void;
}) {
  const declared = useMemo(() => extractDeclaredTags(content), [content]);

  if (declared.length === 0 && !onAddTag) return null;

  return (
    <div className="px-6 py-1.5 border-b border-trevor-border-subtle flex items-center gap-1.5 flex-wrap flex-shrink-0 bg-trevor-bg">
      <TagIcon size={11} className="text-trevor-text-muted flex-shrink-0" />
      {declared.length === 0 ? (
        <span className="text-[11px] text-trevor-text-muted italic">No tags yet</span>
      ) : (
        declared.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-[11px] rounded-full bg-trevor-accent/15 text-trevor-accent border border-trevor-accent/30"
          >
            #{t}
            <button
              onClick={() => onChange(removeDeclaredTag(content, t))}
              className="p-0.5 rounded-full text-trevor-accent/70 hover:text-trevor-danger hover:bg-trevor-danger/10 transition-colors"
              title={`Remove #${t}`}
            >
              ×
            </button>
          </span>
        ))
      )}
      {onAddTag && (
        <button
          onClick={onAddTag}
          className="inline-flex items-center gap-0.5 pl-1.5 pr-2 py-0.5 text-[11px] rounded-full border border-dashed border-trevor-border text-trevor-text-muted hover:text-trevor-accent hover:border-trevor-accent transition-colors"
          title="Manage tags"
        >
          <Plus size={10} /> tag
        </button>
      )}
    </div>
  );
}
