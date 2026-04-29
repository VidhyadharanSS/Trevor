/**
 * Trevor — Vault Picker (First Launch)
 */

import { FolderOpen, Sparkles, AlertCircle } from "lucide-react";
import { getFS } from "@/lib/fs";
import { isTauri } from "@/lib/platform";
import { useState } from "react";

interface Props {
  onVaultSelected: (path: string) => void | Promise<void>;
  error?: string | null;
}

export function VaultPicker({ onVaultSelected, error }: Props) {
  const [busy, setBusy] = useState(false);

  const handlePick = async () => {
    setBusy(true);
    try {
      const fs = await getFS();
      const path = await fs.pickFolder();
      if (path) {
        await onVaultSelected(path);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUseDemo = async () => {
    setBusy(true);
    try {
      await onVaultSelected("/vault");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-trevor-bg text-trevor-text px-6">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-trevor-accent to-indigo-700 shadow-lg shadow-trevor-accent/20 mb-6">
          <Sparkles size={32} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-2 tracking-tight">Welcome to Trevor</h1>
        <p className="text-trevor-text-muted text-sm leading-relaxed mb-8">
          A simple, fast, distraction-free note-taking app. Your notes are plain Markdown files
          stored in a folder of your choice — fully under your control.
        </p>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm mb-4 text-left">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={handlePick}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-trevor-accent hover:bg-trevor-accent-hover text-white font-medium transition-colors shadow-lg shadow-trevor-accent/20 disabled:opacity-60 disabled:cursor-wait"
        >
          <FolderOpen size={18} />
          {busy ? "Opening…" : "Choose Vault Folder"}
        </button>

        {!isTauri() && (
          <button
            onClick={handleUseDemo}
            disabled={busy}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-trevor-surface hover:bg-trevor-surface-hover border border-trevor-border text-trevor-text text-sm transition-colors disabled:opacity-60"
          >
            Try Demo Vault (Browser Preview)
          </button>
        )}

        <p className="text-xs text-trevor-text-muted mt-6 leading-relaxed">
          Tip: Place your vault inside iCloud Drive or Dropbox for free, manual sync across devices.
        </p>
      </div>
    </div>
  );
}
