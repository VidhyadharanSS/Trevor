/**
 * Trevor — History Panel
 *
 * Lists all stored versions of the active note (newest first), with
 * timestamp, byte-size, and a "+added / −removed" badge.  Clicking
 * a version opens a confirmation dialog before restoring.
 */
import { useEffect, useState, useCallback } from "react";
import { History, RotateCcw, Eye, X } from "lucide-react";
import { getVersions, type NoteVersion } from "@/lib/history";

interface HistoryPanelProps {
  activeNotePath: string | null;
  /** Re-fetch trigger — bump on each save so the list refreshes. */
  refreshKey: number;
  onRestore: (version: NoteVersion) => void;
  onPreview: (version: NoteVersion) => void;
}

export function HistoryPanel({ activeNotePath, refreshKey, onRestore, onPreview }: HistoryPanelProps) {
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState<NoteVersion | null>(null);

  const refresh = useCallback(async () => {
    if (!activeNotePath) { setVersions([]); return; }
    setLoading(true);
    try {
      const v = await getVersions(activeNotePath);
      setVersions(v);
    } finally {
      setLoading(false);
    }
  }, [activeNotePath]);

  useEffect(() => { void refresh(); }, [refresh, refreshKey]);

  if (!activeNotePath) {
    return (
      <p className="px-3 py-3 text-[11.5px] text-trevor-text-muted italic">
        Open a note to see its version history.
      </p>
    );
  }

  if (loading) {
    return <p className="px-3 py-3 text-[11.5px] text-trevor-text-muted italic">Loading…</p>;
  }

  if (versions.length === 0) {
    return (
      <p className="px-3 py-3 text-[11.5px] text-trevor-text-muted italic">
        No history yet — keep editing and Trevor will snapshot every save.
      </p>
    );
  }

  return (
    <>
      <ul className="py-1">
        {versions.map((v, i) => (
          <li key={v.id ?? `${v.savedAt}-${i}`}>
            <div className="group flex items-start gap-2 px-3 py-1.5 hover:bg-trevor-surface-hover/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-trevor-text">
                  {formatRelative(v.savedAt)}
                  {i === 0 && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-trevor-success">
                      latest
                    </span>
                  )}
                </div>
                <div className="text-[10.5px] text-trevor-text-muted mt-0.5 flex items-center gap-2">
                  <span>{formatTime(v.savedAt)}</span>
                  <span className="text-trevor-success">+{v.added}</span>
                  <span className="text-trevor-danger">−{v.removed}</span>
                  <span>· {(v.byteSize / 1024).toFixed(1)} KB</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setPreviewing(v); onPreview(v); }}
                  className="p-1 rounded text-trevor-text-muted hover:text-trevor-text hover:bg-trevor-surface-hover transition-colors"
                  title="Preview this version"
                >
                  <Eye size={11} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Restore version from ${formatRelative(v.savedAt)}?\n\nThis will overwrite the current note content. The current version will be saved to history first.`)) {
                      onRestore(v);
                    }
                  }}
                  className="p-1 rounded text-trevor-text-muted hover:text-trevor-accent hover:bg-trevor-accent/10 transition-colors"
                  title="Restore this version"
                >
                  <RotateCcw size={11} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Preview modal */}
      {previewing && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in"
          onClick={() => setPreviewing(null)}
        >
          <div
            className="w-full max-w-3xl h-[70vh] bg-trevor-bg-secondary border border-trevor-border rounded-xl shadow-elevation-2 flex flex-col overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-trevor-border-subtle">
              <div className="flex items-center gap-2">
                <History size={14} className="text-trevor-accent" />
                <h3 className="text-[14px] font-medium text-trevor-text">
                  Version preview · {formatRelative(previewing.savedAt)}
                </h3>
              </div>
              <button
                onClick={() => setPreviewing(null)}
                className="p-1 rounded text-trevor-text-muted hover:text-trevor-text hover:bg-trevor-surface-hover transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <pre className="flex-1 overflow-auto scrollbar-thin px-5 py-4 m-0 bg-trevor-bg text-trevor-text text-[12.5px] font-mono whitespace-pre-wrap">
              {previewing.content}
            </pre>
            <div className="px-4 py-3 border-t border-trevor-border-subtle flex items-center justify-end gap-2">
              <button
                onClick={() => setPreviewing(null)}
                className="px-3 py-1.5 text-[12.5px] text-trevor-text-secondary hover:text-trevor-text rounded hover:bg-trevor-surface-hover transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onRestore(previewing);
                  setPreviewing(null);
                }}
                className="px-3 py-1.5 text-[12.5px] bg-trevor-accent text-white rounded hover:bg-trevor-accent-hover transition-colors flex items-center gap-1.5"
              >
                <RotateCcw size={12} /> Restore this version
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}
