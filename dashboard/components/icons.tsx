// Minimal line icons (currentColor, 1.6 stroke) for the sidebar + UI.
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "home":
      return <svg {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>;
    case "policies":
      return <svg {...common}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
    case "audit":
      return <svg {...common}><path d="M5 3h9l5 5v13H5z" /><path d="M14 3v5h5" /><path d="M8 13h7M8 17h7M8 9h2" /></svg>;
    case "approvals":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5L16 9" /></svg>;
    case "keys":
      return <svg {...common}><circle cx="8" cy="8" r="4" /><path d="m11 11 8 8" /><path d="m16 16 2-2M19 13l1-1" /></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V22a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 5.9 4.2l.1.1a1.6 1.6 0 0 0 1.8.3H8a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H22a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></svg>;
    case "tenants":
      return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
    case "signout":
      return <svg {...common}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5" /><path d="M5 12h11" /></svg>;
    // action-type glyphs for the activity list
    case "payment":
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></svg>;
    case "database":
      return <svg {...common}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>;
    case "mail":
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
    case "read":
      return <svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
    case "bolt":
      return <svg {...common}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></svg>;
    case "plug":
      return <svg {...common}><path d="M12 22v-5" /><path d="M9 7V2M15 7V2" /><path d="M7 7h10v4a5 5 0 0 1-10 0z" /></svg>;
    case "spark":
      return <svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m6.3 6.3 2.4 2.4M15.3 15.3l2.4 2.4M17.7 6.3l-2.4 2.4M8.7 15.3l-2.4 2.4" /></svg>;
    case "cloud":
      return <svg {...common}><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.98A6 6 0 0 0 6.3 11 4 4 0 0 0 7 19h10.5Z" /></svg>;
    case "chat":
      return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" /></svg>;
    case "server":
      return <svg {...common}><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></svg>;
    case "code":
      return <svg {...common}><path d="m16 18 4-4-4-4M8 6l-4 4 4 4M13 4l-2 16" /></svg>;
    case "copy":
      return <svg {...common}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
    case "check":
      return <svg {...common}><path d="M20 6 9 17l-5-5" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="9" /></svg>;
  }
}
