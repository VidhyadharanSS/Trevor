/**
 * Trevor — Portal Menu
 *
 * A reusable dropdown that renders its menu into `document.body` via
 * React portal, so it cannot be clipped by any ancestor's
 * `overflow:hidden`, `overflow-x-auto`, transform, or filter.
 *
 * The menu is anchored to the bounding rect of the trigger element and
 * automatically flips above the trigger if there is not enough room
 * below the viewport.
 *
 * Why we need this:
 *   The editor toolbar uses `overflow-x-auto` so it can horizontally
 *   scroll on narrow windows. That same overflow clips any absolutely
 *   positioned descendant — making dropdowns invisible. Portalling
 *   bypasses the clipping entirely.
 */
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface PortalMenuProps {
  /** The element that toggles the menu. Must accept onClick + ref. */
  trigger: React.ReactElement<{
    onClick?: (e: React.MouseEvent) => void;
    "aria-expanded"?: boolean;
  }>;
  /** Menu content. */
  children: React.ReactNode;
  /** Optional fixed width class — defaults to w-44. */
  widthClass?: string;
  /** Alignment of the menu relative to the trigger. */
  align?: "start" | "end";
  /** Optional gap between trigger and menu (px). */
  offset?: number;
  /** Optional title for accessibility / tooltip. */
  title?: string;
}

export function PortalMenu({
  trigger,
  children,
  widthClass = "w-44",
  align = "start",
  offset = 4,
  title,
}: PortalMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    top: number; left: number; width: number; placement: "below" | "above";
  } | null>(null);

  /** Recompute the menu position from the trigger rect. */
  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuEl = menuRef.current;
    const menuH = menuEl?.offsetHeight ?? 220;
    const menuW = menuEl?.offsetWidth ?? 176;
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    // Default: open below.
    let top = rect.bottom + offset;
    let placement: "below" | "above" = "below";
    if (top + menuH > vh - 8 && rect.top - offset - menuH > 8) {
      top = rect.top - offset - menuH;
      placement = "above";
    }

    // Horizontal alignment.
    let left =
      align === "end"
        ? rect.right - menuW
        : rect.left;
    // Clamp to viewport.
    if (left + menuW > vw - 8) left = vw - 8 - menuW;
    if (left < 8) left = 8;

    setPos({ top, left, width: menuW, placement });
  }, [align, offset]);

  // Recompute on open + resize/scroll.
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => reposition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, reposition]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Compose the trigger so its onClick toggles us.
  const enhancedTrigger = isValidElement(trigger)
    ? cloneElement(trigger, {
        ref: (n: HTMLElement | null) => { triggerRef.current = n; },
        onClick: (e: React.MouseEvent) => {
          trigger.props.onClick?.(e);
          setOpen((v) => !v);
        },
        "aria-expanded": open,
        ...(title ? { title } : {}),
      } as Record<string, unknown>)
    : trigger;

  return (
    <>
      {enhancedTrigger}
      {open && pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className={`fixed z-[10000] ${widthClass} bg-trevor-bg-elevated border border-trevor-border rounded-md shadow-elevation-2 py-1 animate-fade-in`}
            style={{ top: pos.top, left: pos.left }}
            onClick={(e) => {
              // Close on any item click — items use buttons that bubble here.
              const tag = (e.target as HTMLElement).closest("button");
              if (tag) setOpen(false);
            }}
          >
            {children}
          </div>,
          document.body,
        )
      }
    </>
  );
}
