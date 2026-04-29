/**
 * Trevor — Tag Manager
 *
 * Per-note tag editor.  Lets the user:
 *   • View declared tags (curated, stored in YAML frontmatter)
 *   • View inline #hashtags (auto-detected, distinct visual style)
 *   • Add a new declared tag (with autocomplete from vault-wide tags)
 *   • Remove a declared tag
 *   • Promote an inline tag to a declared tag
 *
 * The component is fully controlled — the parent owns the note content
 * and persists changes; we only emit `onChange(nextContent)`.
 */
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { X, Plus, Tag as TagIcon, Hash, ArrowUp } from "lucide-react";
import {
  extractAllTags,
  addDeclaredTag,
  removeDeclaredTag,
} from "@/lib/tags";

interface TagManagerProps {
  open: boolean;
  onClose: () => void;
  /** The full markdown content (frontmatter + body). */
  content: string;
  /** Emit the next markdown content after a tag mutation. */
  onChange: (next: string) => void;
  /** All tags known across the vault (for autocomplete suggestions). */
  vaultTags: string[];
}

const TAG_RE = /^[A-Za-z][\w/-]*$/;

export function TagManager({ open, onClose, content, onChange, vaultTags }: TagManagerProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { declared, inline } = useMemo(
    () => extractAllTags(content),
    [content],
  );

  // Suggestions: vault tags not already declared on this note that match the draft.
  const suggestions = useMemo(() => {
    const term = draft.trim().toLowerCase().replace(/^#/, "");
    const declaredSet = new Set(declared);
    const all = vaultTags.filter((t) => !declaredSet.has(t));
    if (!term) return all.slice(0, 8);
    return all
      .filter((t) => t.toLowerCase().includes(term))
      .slice(0, 8);
  }, [draft, vaultTags, declared]);

  // Focus input on open.
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleAdd = useCallback(
    (raw: string) => {
      const cleaned = raw.trim().replace(/^#/, "").replace(/\s+/g, "-");
      if (!cleaned) return;
      if (!TAG_RE.test(cleaned)) {
        // Reject silently with a simple shake; in a real app we'd show a toast.
        return;
      }
      onChange(addDeclaredTag(content, cleaned));
      setDraft("");
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [content, onChange],
  );

  const handleRemove = useCallback(
    (tag: string) => {
      onChange(removeDeclaredTag(content, tag));
    },
    [content, onChange],
  );

  const handlePromote = useCallback(
    (tag: string) => {
      onChange(addDeclaredTag(content, tag));
    },
    [content, onChange],
  );

  if (!open) return null;

  const isValidDraft = TAG_RE.test(draft.replace(/^#/, "").replace(/\s+/g, "-")) && draft.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-trevor-bg-secondary border border-trevor-border rounded-xl shadow-elevation-2 overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-trevor-border-subtle">
          <div className="flex items-center gap-2">
            <TagIcon size={14} className="text-trevor-accent" />
            <h3 className="text-[14px] font-medium text-trevor-text">Tags</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-trevor-text-muted hover:text-trevor-text hover:bg-trevor-surface-hover transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Add input */}
          <div>
            <label className="block text-[10.5px] uppercase tracking-wider text-trevor-text-muted mb-1.5">
              Add a tag
            </label>
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-trevor-bg border border-trevor-border-subtle rounded-lg focus-within:border-trevor-accent/50 transition-colors">
              <Hash size={13} className="text-trevor-text-muted" />
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd(draft);
                  }
                }}
                placeholder="e.g. project-alpha"
                className="flex-1 bg-transparent text-[13px] text-trevor-text placeholder:text-trevor-text-muted outline-none"
                spellCheck={false}
              />
              <button
                onClick={() => handleAdd(draft)}
                disabled={!isValidDraft}
                className="p-1 rounded text-trevor-accent hover:bg-trevor-accent/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Add (Enter)"
              >
                <Plus size={14} />
              </button>
            </div>
            <p className="text-[10.5px] text-trevor-text-muted mt-1.5">
              Letters, numbers, <code className="text-trevor-accent">-</code>{" "}
              and <code className="text-trevor-accent">/</code>. Use{" "}
              <code className="text-trevor-accent">parent/child</code> for nesting.
            </p>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div>
              <div className="text-[10.5px] uppercase tracking-wider text-trevor-text-muted mb-1.5">
                Suggestions from this vault
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((t) => (
                  <button
                    key={t}
                    onClick={() => handleAdd(t)}
                    className="px-2 py-0.5 text-[11.5px] rounded-full bg-trevor-bg-tertiary border border-trevor-border-subtle text-trevor-text-secondary hover:border-trevor-accent hover:text-trevor-accent transition-colors"
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Declared tags */}
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-trevor-text-muted mb-1.5 flex items-center gap-1.5">
              <TagIcon size={10} /> Declared on this note
            </div>
            {declared.length === 0 ? (
              <p className="text-[12px] text-trevor-text-muted italic">
                No declared tags yet — add one above.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {declared.map((t) => (
                  <span
                    key={t}
                    className="group inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-[12px] rounded-full bg-trevor-accent/15 text-trevor-accent border border-trevor-accent/30"
                  >
                    #{t}
                    <button
                      onClick={() => handleRemove(t)}
                      className="p-0.5 rounded-full text-trevor-accent/60 hover:text-trevor-danger hover:bg-trevor-danger/10 transition-colors"
                      title={`Remove #${t}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Inline tags (visually distinct, with promote action) */}
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-trevor-text-muted mb-1.5 flex items-center gap-1.5">
              <Hash size={10} /> Inline #hashtags found in body
            </div>
            {inline.length === 0 ? (
              <p className="text-[12px] text-trevor-text-muted italic">
                No inline hashtags in this note.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {inline.map((t) => {
                  const alreadyDeclared = declared.includes(t);
                  return (
                    <span
                      key={t}
                      className={`group inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-[12px] rounded-full border ${
                        alreadyDeclared
                          ? "bg-trevor-success/10 text-trevor-success border-trevor-success/30"
                          : "bg-trevor-bg-tertiary border-trevor-border text-trevor-text-secondary"
                      }`}
                      title={alreadyDeclared ? "Also declared" : "Inline only — click ⬆ to promote"}
                    >
                      #{t}
                      {!alreadyDeclared && (
                        <button
                          onClick={() => handlePromote(t)}
                          className="p-0.5 rounded-full hover:text-trevor-accent hover:bg-trevor-accent/10 transition-colors"
                          title={`Promote #${t} to declared tags`}
                        >
                          <ArrowUp size={10} />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-trevor-border-subtle text-[10.5px] text-trevor-text-muted flex items-center justify-between">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-trevor-accent" /> declared
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-trevor-text-muted" /> inline
            </span>
          </span>
          <span><kbd className="font-mono">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
