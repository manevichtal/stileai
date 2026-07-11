// StileAI mark: a single blue shield with a check. This is the ONE brand glyph,
// used everywhere (app nav, favicon, landing header, browser extension) so the
// icon is identical across every surface. Inline SVG so it needs no assets and
// stays crisp at any size.
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" fill="#1953F0" />
      <path
        d="M9 12l2 2 4-4"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
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
