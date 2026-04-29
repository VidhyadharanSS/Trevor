/**
 * Trevor — Title Bar
 *
 * Top chrome strip:
 *   • Drag region for native window movement (Tauri).
 *   • Vault switcher (dropdown) — recent vaults + "Open another…".
 *   • Right cluster: Search (⌘K), Daily, Graph, Canvas, Export menu,
 *     Pomodoro, Help, Side panel toggle, Settings.
 */
import { useVault } from "@/lib/store";
import { platform } from "@/lib/platform";
import {
  Search, Network, Settings as SettingsIcon, CalendarDays,
  PanelRightOpen, PanelRightClose, Layout, Download,
  Clock, HelpCircle, ChevronDown, FileDown, FileText, Package, Upload,
} from "lucide-react";
import { VaultSwitcher } from "@/components/vault/VaultSwitcher";
import { PortalMenu } from "@/components/ui/PortalMenu";

interface TitleBarProps {
  onOpenSettings: () => void;
  onOpenPalette: () => void;
  onOpenGraph: () => void;
  onOpenDaily: () => void;
  onOpenCanvas: () => void;
  onOpenHelp: () => void;
  onTogglePomodoro: () => void;
  pomodoroOpen: boolean;
  onTogglePanel: () => void;
  panelOpen: boolean;
  onSwitchVault: (path: string) => void;
  onOpenNewVault: () => void;
  onExportPdf: () => void;
  onExportHtml: () => void;
  onExportMarkdown: () => void;
  onExportVault: () => void;
  onImportVault: () => void;
  hasActiveNote: boolean;
}

export function TitleBar({
  onOpenSettings,
  onOpenPalette,
  onOpenGraph,
  onOpenDaily,
  onOpenCanvas,
  onOpenHelp,
  onTogglePomodoro,
  pomodoroOpen,
  onTogglePanel,
  panelOpen,
  onSwitchVault,
  onOpenNewVault,
  onExportPdf,
  onExportHtml,
  onExportMarkdown,
  onExportVault,
  onImportVault,
  hasActiveNote,
}: TitleBarProps) {
  const { state } = useVault();

  const btn = "p-1.5 rounded text-trevor-text-muted hover:text-trevor-text hover:bg-trevor-surface-hover transition-colors";
  const btnActive = "text-trevor-accent bg-trevor-surface-hover";

  return (
    <div
      data-tauri-drag-region
      className="flex items-center h-9 bg-trevor-bg-elevated border-b border-trevor-border flex-shrink-0 select-none relative"
      style={{ paddingLeft: platform.isMac ? 78 : 12, paddingRight: 8 }}
    >
      {/* Spacer (left) */}
      <div className="flex-1" />

      {/* Vault switcher (centre) */}
      <VaultSwitcher
        currentPath={state.vaultPath}
        onSwitch={onSwitchVault}
        onOpenNew={onOpenNewVault}
      />

      {/* Action cluster (right) */}
      <div className="flex-1 flex items-center justify-end gap-0.5">
        <button onClick={onOpenPalette} className={btn} title="Search & commands (⌘K)">
          <Search size={14} />
        </button>
        <button onClick={onOpenDaily} className={btn} title="Today's daily note (⌘⇧D)">
          <CalendarDays size={14} />
        </button>
        <button onClick={onOpenGraph} className={btn} title="Graph view (⌘⇧G)">
          <Network size={14} />
        </button>
        <button onClick={onOpenCanvas} className={btn} title="New canvas (⌘⇧C)">
          <Layout size={14} />
        </button>

        {/* Export menu (portal-rendered to escape any clipping) */}
        <PortalMenu
          title="Export"
          align="end"
          widthClass="w-52"
          trigger={
            <button type="button" className={`${btn} flex items-center gap-0.5`}>
              <Download size={14} />
              <ChevronDown size={9} />
            </button>
          }
        >
          <ExportItem
            icon={FileDown}
            label="Note as PDF"
            hint="Print dialog"
            disabled={!hasActiveNote}
            onClick={onExportPdf}
          />
          <ExportItem
            icon={FileText}
            label="Note as HTML"
            hint="Self-contained file"
            disabled={!hasActiveNote}
            onClick={onExportHtml}
          />
          <ExportItem
            icon={FileText}
            label="Note as Markdown"
            hint="Plain .md"
            disabled={!hasActiveNote}
            onClick={onExportMarkdown}
          />
          <div className="my-1 border-t border-trevor-border-subtle" />
          <ExportItem
            icon={Package}
            label="Whole vault as bundle"
            hint="All notes in one .md"
            onClick={onExportVault}
          />
          <div className="my-1 border-t border-trevor-border-subtle" />
          <ExportItem
            icon={Upload}
            label="Import vault bundle"
            hint="Pick a .md bundle to add"
            onClick={onImportVault}
          />
        </PortalMenu>

        <button
          onClick={onTogglePomodoro}
          className={`${btn} ${pomodoroOpen ? btnActive : ""}`}
          title="Focus timer (⌘P)"
        >
          <Clock size={14} />
        </button>
        <button onClick={onOpenHelp} className={btn} title="Keyboard shortcuts (⌘/)">
          <HelpCircle size={14} />
        </button>
        <button
          onClick={onTogglePanel}
          className={`${btn} ${panelOpen ? btnActive : ""}`}
          title={panelOpen ? "Hide side panel (⌘.)" : "Show side panel (⌘.)"}
        >
          {panelOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
        </button>
        <button onClick={onOpenSettings} className={btn} title="Settings (⌘,)">
          <SettingsIcon size={14} />
        </button>
      </div>
    </div>
  );
}

function ExportItem({
  icon: Icon, label, hint, onClick, disabled,
}: {
  icon: React.ElementType;
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12.5px] text-trevor-text hover:bg-trevor-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
    >
      <Icon size={13} className="text-trevor-text-muted flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate">{label}</div>
        {hint && <div className="text-[10.5px] text-trevor-text-muted truncate">{hint}</div>}
      </div>
    </button>
  );
}
