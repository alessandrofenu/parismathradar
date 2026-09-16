import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

// $$…$$, \[…\], $…$, \(…\)
const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g;

export function renderMath(text: string): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(MATH_RE)) {
    const idx = m.index ?? 0;
    out += escape(text.slice(last, idx));
    const display = m[1] !== undefined || m[2] !== undefined;
    const tex = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
    try {
      out += katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: "ignore", output: "html" });
    } catch {
      out += escape(m[0]);
    }
    last = idx + m[0].length;
  }
  out += escape(text.slice(last));
  return out;
}

/** Text with inline TeX rendered by KaTeX. Everything else is escaped. */
export function MathText({ text, className, as = "span" }: { text: string | null | undefined; className?: string; as?: "span" | "div" | "p" }) {
  const html = useMemo(() => renderMath(text ?? ""), [text]);
  const Tag = as;
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
