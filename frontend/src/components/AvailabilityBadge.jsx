/**
 * AvailabilityBadge
 * Consistent badge for the three bus availability states — no emojis, professional look.
 *
 * Props:
 *   status  — "running" | "offline" | "inactive"
 *   size    — "sm" (default) | "lg"
 */

const CONFIG = {
  running:  { label: "Running",           dotColor: "#10b981", textColor: "#059669", bg: "rgba(16,185,129,.1)"  },
  offline:  { label: "Offline Today",     dotColor: "#f97316", textColor: "#ea6c00", bg: "rgba(249,115,22,.1)"  },
  inactive: { label: "Not Running Today", dotColor: "#9ca3af", textColor: "#6b7280", bg: "rgba(156,163,175,.12)" },
};

export default function AvailabilityBadge({ status = "inactive", size = "sm" }) {
  const cfg = CONFIG[status] ?? CONFIG.inactive;
  const isLg = size === "lg";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isLg ? 8 : 6,
        padding: isLg ? "7px 14px" : "5px 11px",
        borderRadius: 100,
        background: cfg.bg,
        fontSize: isLg ? 13 : 11,
        fontWeight: 700,
        color: cfg.textColor,
        whiteSpace: "nowrap",
        fontFamily: "var(--font-body)",
      }}
      title={cfg.label}
    >
      {/* Dot indicator */}
      <span style={{
        width: isLg ? 8 : 7,
        height: isLg ? 8 : 7,
        borderRadius: "50%",
        background: cfg.dotColor,
        flexShrink: 0,
        animation: status === "running" ? "pulse 2s infinite" : "none",
        display: "inline-block",
      }} />
      {cfg.label}
    </span>
  );
}
