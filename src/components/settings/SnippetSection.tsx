/**
 * Trevor — Snippet Manager (Settings section)
 *
 * Lets users create, edit, and delete text-snippet shortcuts.  Built-in
 * snippets are visible but their delete button is disabled; their body
 * remains editable so users can customise behaviour.
 */
import { useState } from "react";
import { Plus, Trash2, Code2, RotateCcw } from "lucide-react";
import { useSnippets, type Snippet } from "@/lib/snippets/store";

export function SnippetSection() {
  const snippets = useSnippets((s) => s.snippets);
  const add = useSnippets((s) => s.add);
  const update = useSnippets((s) => s.update);
  const remove = useSnippets((s) => s.remove);
  const reset = useSnippets((s) => s.reset);
  const [editing, setEditing] = useState<string | null>(null);

  const handleAdd = () => {
    add({
      trigger: ":new",
      description: "New snippet",
      body: "Write the snippet body here. Use {{cursor}} to mark the caret rest position.",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h4 className="text-[13px] font-medium text-trevor-text">Text snippets</h4>
          <p className="text-[11.5px] text-trevor-text-muted mt-0.5">
            Type a snippet's <code className="text-trevor-accent">:trigger</code> followed by{" "}
            <kbd className="px-1 py-0.5 text-[10px] bg-trevor-bg-elevated border border-trevor-border rounded font-mono">Tab</kbd>{" "}
            to expand it.  Tokens supported in bodies:{" "}
            <code className="text-trevor-accent">{"{{date}}"}</code>{" "}
            <code className="text-trevor-accent">{"{{time}}"}</code>{" "}
            <code className="text-trevor-accent">{"{{datetime}}"}</code>{" "}
            <code className="text-trevor-accent">{"{{title}}"}</code>{" "}
            <code className="text-trevor-accent">{"{{cursor}}"}</code>
          </p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={handleAdd}
            className="px-2.5 py-1.5 text-[12px] bg-trevor-accent text-white rounded hover:bg-trevor-accent-hover transition-colors flex items-center gap-1.5"
          >
            <Plus size={12} /> New snippet
          </button>
          <button
            onClick={() => { if (confirm("Restore default snippets? Your custom ones will remain.")) reset(); }}
            className="px-2.5 py-1.5 text-[12px] text-trevor-text-muted hover:text-trevor-text rounded hover:bg-trevor-surface-hover transition-colors flex items-center gap-1.5"
            title="Restore defaults"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      <div className="border border-trevor-border rounded-lg overflow-hidden">
        <table className="w-full text-[12.5px]">
          <thead className="bg-trevor-bg-tertiary">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-trevor-text-muted text-[10.5px] uppercase tracking-wider w-[110px]">Trigger</th>
              <th className="text-left px-3 py-2 font-medium text-trevor-text-muted text-[10.5px] uppercase tracking-wider">Description</th>
              <th className="text-left px-3 py-2 font-medium text-trevor-text-muted text-[10.5px] uppercase tracking-wider w-[80px]">Body</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {snippets.map((s) => (
              <SnippetRow
                key={s.id}
                snippet={s}
                expanded={editing === s.id}
                onToggleExpand={() => setEditing((id) => (id === s.id ? null : s.id))}
                onUpdate={(patch) => update(s.id, patch)}
                onRemove={() => remove(s.id)}
              />
            ))}
            {snippets.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[11.5px] text-trevor-text-muted italic">
                  No snippets — add one above to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SnippetRow({
  snippet, expanded, onToggleExpand, onUpdate, onRemove,
}: {
  snippet: Snippet;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<Snippet>) => void;
  onRemove: () => void;
}) {
  return (
    <>
      <tr className="border-t border-trevor-border-subtle hover:bg-trevor-surface-hover/30 transition-colors">
        <td className="px-3 py-1.5">
          <input
            value={snippet.trigger}
            onChange={(e) => onUpdate({ trigger: e.target.value })}
            className="bg-transparent border border-transparent hover:border-trevor-border focus:border-trevor-accent rounded px-1.5 py-0.5 text-trevor-accent font-mono text-[12px] outline-none w-full"
          />
        </td>
        <td className="px-3 py-1.5">
          <input
            value={snippet.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            className="bg-transparent border border-transparent hover:border-trevor-border focus:border-trevor-accent rounded px-1.5 py-0.5 text-trevor-text text-[12.5px] outline-none w-full"
          />
        </td>
        <td className="px-3 py-1.5">
          <button
            onClick={onToggleExpand}
            className="px-2 py-0.5 text-[11px] text-trevor-text-muted hover:text-trevor-text rounded hover:bg-trevor-surface-hover transition-colors flex items-center gap-1"
          >
            <Code2 size={11} />
            {expanded ? "Hide" : "Edit"}
          </button>
        </td>
        <td className="px-2">
          <button
            onClick={onRemove}
            disabled={snippet.builtin}
            className="p-1.5 text-trevor-text-muted hover:text-trevor-danger rounded hover:bg-trevor-danger/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={snippet.builtin ? "Built-in snippets can't be deleted" : "Delete snippet"}
          >
            <Trash2 size={12} />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-trevor-bg-tertiary border-t border-trevor-border-subtle">
          <td colSpan={4} className="px-3 py-2">
            <textarea
              value={snippet.body}
              onChange={(e) => onUpdate({ body: e.target.value })}
              rows={6}
              className="w-full bg-trevor-bg border border-trevor-border rounded px-2.5 py-2 text-[12.5px] text-trevor-text font-mono focus:border-trevor-accent outline-none resize-y"
              placeholder="Snippet body…"
            />
          </td>
        </tr>
      )}
    </>
  );
}
