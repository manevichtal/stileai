// StileAI wordmark + interlocking-brackets glyph (from the interlock_20.html
// reference). Kept as an inline SVG so it needs no assets and stays crisp.
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <g
        stroke="#1953F0"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 11V6.5A2.5 2.5 0 0 1 6.5 4H11" />
        <path d="M21 4h4.5A2.5 2.5 0 0 1 28 6.5V11" />
        <path d="M28 21v4.5a2.5 2.5 0 0 1-2.5 2.5H21" />
        <path d="M11 28H6.5A2.5 2.5 0 0 1 4 25.5V21" />
      </g>
      <rect
        x="11.6"
        y="11.6"
        width="8.8"
        height="8.8"
        rx="2"
        transform="rotate(45 16 16)"
        fill="#1953F0"
      />
    </svg>
  );
}

export function Brand({ size = 22 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark size={size + 8} />
      <span
        className="font-sans font-extrabold tracking-tight text-ink"
        style={{ fontSize: size, letterSpacing: "-0.025em" }}
      >
        StileAI
      </span>
    </span>
  );
}
