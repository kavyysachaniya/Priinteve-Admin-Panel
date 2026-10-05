"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

/** Edits a string[] as one entry per line (commas also split for keyword-style lists). */
export function LinesInput({
  id,
  value,
  onChange,
  placeholder,
  splitCommas = false,
  rows = 4,
}: {
  id?: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  splitCommas?: boolean;
  rows?: number;
}) {
  // Keep the raw text locally so typing a trailing newline or comma isn't swallowed.
  const [text, setText] = useState(() => value.join("\n"));

  function handleChange(next: string) {
    setText(next);
    const parts = next
      .split(splitCommas ? /[\n,]/ : /\n/)
      .map((part) => part.trim())
      .filter(Boolean);
    onChange(parts);
  }

  return (
    <Textarea id={id} rows={rows} value={text} placeholder={placeholder} onChange={(e) => handleChange(e.target.value)} />
  );
}
