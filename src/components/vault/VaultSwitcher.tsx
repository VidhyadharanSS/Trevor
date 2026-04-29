/**
 * Trevor — Vault Switcher
 *
 * Dropdown menu (anchored under the vault label in the TitleBar) listing
 * recently-opened vaults plus an "Open another vault…" command.  Lets
 * the user quickly jump between local vaults without leaving the app.
 */
import { useState, useEffect, useRef } from "react";
import { ChevronDown, FolderOpen, Plus, Check, X } from "lucide-react";
import {
  getRecentVaults,
  removeRecentVault,
  type RecentVault,
} from "@/lib/vaults/recent";

interface VaultSwitcherProps {
  currentPath: string | null;
  onSwitch: (path: string) => void;
  onOpenNew: () => void;
}

export function VaultSwitcher({ currentPath, onSwitch, onOpenNew }: VaultSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<RecentVault[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Refresh recents whenever opened.
  useEffect(() => {
    if (open) setRecents(getRecentVaults());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const currentName =
    currentPath?.split(/[/\\]/).filter(Boolean).pop() ?? "Trevor";

  return (
    <div ref={containerRef} className="relative pointer-events-auto">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11.5px] text-trevor-text-muted hover:text-trevor-text hover:bg-trevor-surface-hover transition-colors"
        title="Switch vault"
      >
        <FolderOpen size={11} />
        <span className="font-medium">{currentName}</span>
        <ChevronDown size={10} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 w-72 bg-trevor-bg-elevated border border-trevor-border rounded-md shadow-elevation-2 py-1 animate-fade-in">
          <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-trevor-text-muted">
            Recent vaults
          </div>
          {recents.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-trevor-text-muted italic">
              No recent vaults
            </div>
          ) : (
            recents.map((v) => {
              const active = v.path === currentPath;
              return (
                <div
                  key={v.path}
                  className={`group flex items-center gap-2 px-3 py-1.5 hover:bg-trevor-surface-hover transition-colors ${
                    active ? "bg-trevor-surface-hover/60" : ""
                  }`}
                >
                  <button
                    onClick={() => { setOpen(false); onSwitch(v.path); }}
                    className="flex-1 flex items-center gap-2 min-w-0 text-left"
                  >
                    <FolderOpen size={12} className={active ? "text-trevor-accent" : "text-trevor-text-muted"} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] text-trevor-text truncate">{v.name}</div>
                      <div className="text-[10.5px] text-trevor-text-muted truncate">{v.path}</div>
                    </div>
                    {active && <Check size={12} className="text-trevor-accent" />}
                  </button>
                  {!active && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentVault(v.path);
                        setRecents(getRecentVaults());
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-trevor-text-muted hover:text-trevor-danger transition-all"
                      title="Forget this vault"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })
          )}
          <div className="border-t border-trevor-border-subtle my-1" />
          <button
            onClick={() => { setOpen(false); onOpenNew(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-trevor-accent hover:bg-trevor-surface-hover transition-colors"
          >
            <Plus size={12} /> Open another vault…
          </button>
        </div>
      )}
    </div>
  );
}
