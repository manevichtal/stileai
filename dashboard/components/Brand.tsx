// StileAI shield glyph — the canonical brand mark, matching the app favicon and
// the browser extension. Inline SVG so it needs no assets and stays crisp. The
// gradient ids are shared across instances on a page, which is fine: every
// instance is identical, so referencing the first def renders them all the same.
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id="stileShieldB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2E8CE8" />
          <stop offset="1" stopColor="#1157AE" />
        </linearGradient>
        <linearGradient id="stileShieldG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4DA86" />
          <stop offset=".5" stopColor="#E0B33A" />
          <stop offset="1" stopColor="#B9862A" />
        </linearGradient>
      </defs>
      <path
        d="M7 6C7 5.25 7.5 5 8.25 5L23.75 5C24.5 5 25 5.25 25 6C25 10 25.5 13 25 16C24.5 21 20.75 24.5 16 27.25C11.25 24.5 7.5 21 7 16C6.5 13 7 10 7 6Z"
        fill="url(#stileShieldB)"
        stroke="url(#stileShieldG)"
        strokeWidth="1.6"
        strokeLinejoin="round"
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
