/**
 * Trevor — Toggle Switch (shared)
 *
 * A pixel-perfect, accessible toggle component.
 * Track 36×20px, knob 16×16px, 2px inset.  Translates 16px when on,
 * so knob sits flush at both ends.  Animated and keyboard-friendly.
 */
import { forwardRef } from "react";

interface ToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
  size?: "sm" | "md";
  disabled?: boolean;
  label?: string;
  ariaLabel?: string;
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { value, onChange, size = "md", disabled = false, label, ariaLabel },
  ref,
) {
  const dims =
    size === "sm"
      ? { track: "w-8 h-[18px]", knob: "w-3.5 h-3.5", on: "translate-x-[14px]", off: "translate-x-[2px]" }
      : { track: "w-10 h-[22px]", knob: "w-[18px] h-[18px]", on: "translate-x-[20px]", off: "translate-x-[2px]" };

  return (
    <button
      ref={ref}
      role="switch"
      type="button"
      aria-checked={value}
      aria-label={ariaLabel ?? label ?? "Toggle"}
      disabled={disabled}
      onClick={() => !disabled && onChange(!value)}
      className={[
        "relative inline-flex flex-shrink-0 items-center rounded-full transition-colors duration-150",
        dims.track,
        value
          ? "bg-trevor-accent shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
          : "bg-trevor-surface-hover shadow-[inset_0_0_0_1px_var(--color-border)]",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:brightness-110",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block rounded-full bg-white shadow-sm transition-transform duration-150",
          dims.knob,
          value ? dims.on : dims.off,
        ].join(" ")}
      />
    </button>
  );
});
