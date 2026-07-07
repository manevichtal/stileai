"use client";

import { useEffect, useState } from "react";

// Renders a timestamp in the VIEWER's timezone. Server components format dates in
// the server's timezone (UTC on Vercel), which shows the wrong time — so absolute
// times must be formatted in the browser. Renders nothing until mounted to avoid a
// hydration mismatch.
export function LocalTime({ ts, mode = "datetime" }: { ts: string; mode?: "datetime" | "date" }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const d = new Date(ts);
    setText(mode === "date" ? d.toLocaleDateString() : d.toLocaleString());
  }, [ts, mode]);
  return <span suppressHydrationWarning>{text || " "}</span>;
}
