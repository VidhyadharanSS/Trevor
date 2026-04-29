/**
 * Trevor — Root App Component (Phase 2)
 */

import { useEffect, useReducer, useCallback, useState } from "react";
import { VaultContext, vaultReducer, initialVaultState, useVault } from "@/lib/store";
import { getFS } from "@/lib/fs";
import { VaultPicker } from "@/components/VaultPicker";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2 } from "lucide-react";
import { recordVaultOpen } from "@/lib/vaults/recent";

const VAULT_KEY = "trevor:vaultPath";

function AppShell() {
  const { state, dispatch } = useVault();

  const [showPicker, setShowPicker] = useState(false);

  const openVault = useCallback(
    async (path: string) => {
      dispatch({ type: "SET_LOADING", loading: true });
      try {
        const fs = await getFS();
        const tree = await fs.readDirRecursive(path);
        dispatch({ type: "SET_VAULT", path, tree });
        localStorage.setItem(VAULT_KEY, path);
        recordVaultOpen(path);
        setShowPicker(false);
        try {
          if (fs.startWatching) await fs.startWatching(path);
        } catch {
          /* mock fs */
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to open vault";
        dispatch({ type: "SET_ERROR", error: msg });
        localStorage.removeItem(VAULT_KEY);
        // Show the picker so the user isn't stranded with an unrecoverable
        // vault path (e.g. moved/deleted folder, permissions revoked, USB
        // drive unmounted in production).
        setShowPicker(true);
      }
    },
    [dispatch]
  );

  // Expose globally so AppLayout (deeper in the tree) can trigger.
  useEffect(() => {
    (window as unknown as { __trevor_openVault?: typeof openVault }).__trevor_openVault = openVault;
    (window as unknown as { __trevor_showPicker?: () => void }).__trevor_showPicker = () => setShowPicker(true);
  }, [openVault]);

  // Initial load: try restoring previous vault
  useEffect(() => {
    const stored = localStorage.getItem(VAULT_KEY);
    if (stored) {
      void openVault(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wire FS watcher → refresh tree
  useEffect(() => {
    if (!state.vaultPath) return;
    let unsub: (() => void) | null = null;
    let active = true;

    (async () => {
      const fs = await getFS();
      if (!active) return;
      if (fs.onChange) {
        unsub = fs.onChange(async () => {
          try {
            const tree = await fs.readDirRecursive(state.vaultPath!);
            if (active) dispatch({ type: "SET_TREE", tree });
          } catch {
            /* ignore */
          }
        });
      }
    })();

    return () => {
      active = false;
      if (unsub) unsub();
      void getFS().then((fs) => {
        if (fs.stopWatching) fs.stopWatching().catch(() => {});
      });
    };
  }, [state.vaultPath, dispatch]);

  if (state.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-trevor-bg text-trevor-text">
        <Loader2 size={32} className="animate-spin text-trevor-accent" />
        <p className="mt-4 text-sm text-trevor-text-muted">Loading vault…</p>
      </div>
    );
  }

  if (!state.vaultPath || showPicker) {
    return (
      <VaultPicker
        onVaultSelected={openVault}
        error={state.error}
      />
    );
  }

  return <AppLayout />;
}

export default function App() {
  const [state, dispatch] = useReducer(vaultReducer, initialVaultState);
  return (
    <VaultContext.Provider value={{ state, dispatch }}>
      <AppShell />
    </VaultContext.Provider>
  );
}
