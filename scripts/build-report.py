#!/usr/bin/env python3
"""
build-report.py — Render a Markdown report into a self-contained, print-friendly HTML.

Output is designed to look good on a phone browser AND to "Save as PDF" cleanly
(Chrome/Safari Print preview produces a tidy multi-page PDF with footnotes as
endnotes, page breaks before each H2, and a serif body).

Usage:
    python scripts/build-report.py \
        --markdown assets/staging/98ea3731.md \
        --out      storymaps/austin-chambers/report.html \
        --title    "Austin-Area Chambers of Commerce" \
        --subtitle "Regional and affinity chambers across Greater Austin" \
        [--cover-image assets/staging/header.png]

Design choices (see assets/staging/staging plan.md):
    - Pure Python. Tries `markdown` (with `footnotes` + `tables` extensions);
      falls back to a tiny vendored renderer if the package isn't available.
    - Self-contained: all CSS inlined; no external assets except an optional
      cover image (copied next to the report so the relative <img> works).
    - Footnotes: collected at the end of the document under "References".
"""

from __future__ import annotations

import argparse
import html
import os
import re
import shutil
import sys
from pathlib import Path


# ─── Markdown rendering ──────────────────────────────────────────────────────

def render_markdown(md_text: str) -> str:
    """Render Markdown to HTML, preferring python-markdown with footnotes+tables."""
    try:
        import markdown  # type: ignore
        return markdown.markdown(
            md_text,
            extensions=["footnotes", "tables", "fenced_code", "toc"],
            extension_configs={
                "footnotes": {"BACKLINK_TEXT": "↩"},
            },
            output_format="html5",
        )
    except ImportError:
        pass

    # ── Fallback: minimal renderer (good enough that the page is still readable) ──
    # Handles: H1-H6, paragraphs, **bold**, *italic*, `code`, [text](url), tables,
    # footnote refs [^n] and footnote defs [^n]: text. Not full CommonMark.
    lines = md_text.split("\n")
    out: list[str] = []
    paragraph: list[str] = []
    in_table = False
    table_buf: list[str] = []
    footnote_defs: dict[str, str] = {}

    def flush_paragraph():
        if paragraph:
            text = " ".join(paragraph).strip()
            if text:
                out.append(f"<p>{_inline(text)}</p>")
            paragraph.clear()

    def flush_table():
        nonlocal in_table
        if table_buf:
            out.append(_table_html(table_buf))
            table_buf.clear()
        in_table = False

    def _inline(s: str) -> str:
        s = re.sub(r"\[\^([^\]]+)\]:\s*(.+)", "", s)  # strip footnote defs from inline
        s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
        s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
        s = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", s)
        s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', s)
        s = re.sub(
            r"\[\^([^\]]+)\]",
            lambda m: f'<sup class="fn-ref"><a href="#fn-{m.group(1)}" id="fnref-{m.group(1)}">{m.group(1)}</a></sup>',
            s,
        )
        return s

    def _table_html(rows: list[str]) -> str:
        cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in rows]
        if len(cells) >= 2 and all(set(c) <= set("-: ") for c in cells[1]):
            header, body = cells[0], cells[2:]
        else:
            header, body = cells[0], cells[1:]
        thead = "".join(f"<th>{_inline(c)}</th>" for c in header)
        tbody = "".join(
            "<tr>" + "".join(f"<td>{_inline(c)}</td>" for c in row) + "</tr>"
            for row in body
        )
        return f"<table><thead><tr>{thead}</tr></thead><tbody>{tbody}</tbody></table>"

    for raw in lines:
        line = raw.rstrip()

        # collect footnote definitions
        m = re.match(r"\[\^([^\]]+)\]:\s*(.+)", line)
        if m:
            footnote_defs[m.group(1)] = m.group(2).strip()
            continue

        if line.startswith("|") and "|" in line[1:]:
            flush_paragraph()
            in_table = True
            table_buf.append(line)
            continue
        elif in_table:
            flush_table()

        if not line.strip():
            flush_paragraph()
            continue

        m = re.match(r"^(#{1,6})\s+(.+)", line)
        if m:
            flush_paragraph()
            level = len(m.group(1))
            out.append(f"<h{level}>{_inline(m.group(2))}</h{level}>")
            continue

        paragraph.append(line)

    flush_paragraph()
    flush_table()

    if footnote_defs:
        out.append('<section class="footnotes"><h2>References</h2><ol>')
        for k in sorted(footnote_defs.keys(), key=lambda x: int(x) if x.isdigit() else 0):
            out.append(
                f'<li id="fn-{k}">{_inline(footnote_defs[k])} '
                f'<a class="fn-back" href="#fnref-{k}">↩</a></li>'
            )
        out.append("</ol></section>")

    return "\n".join(out)


# ─── HTML wrapper (self-contained, print-friendly) ───────────────────────────

CSS = """
:root {
  --ink:    #1a1a1a;
  --muted:  #555;
  --rule:   #e5e5e5;
  --accent: #6f4e37;
  --bg:     #fafaf7;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: Georgia, "Iowan Old Style", "Source Serif Pro", serif;
  font-size: 17px;
  line-height: 1.55;
  color: var(--ink);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}
.report {
  max-width: 780px;
  margin: 0 auto;
  padding: 56px 28px 96px;
}
.report-header { border-bottom: 2px solid var(--ink); padding-bottom: 22px; margin-bottom: 36px; }
.eyebrow { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); margin: 0 0 8px; }
h1.title { font-family: Georgia, serif; font-size: 36px; line-height: 1.15; margin: 0 0 8px; font-weight: 700; }
.subtitle { color: var(--muted); font-style: italic; font-size: 18px; margin: 0; }
.cover { width: 100%; max-height: 320px; object-fit: cover; border-radius: 4px; margin: 0 0 36px; }
h2 { font-family: Georgia, serif; font-size: 24px; margin: 48px 0 12px; padding-top: 8px; border-top: 1px solid var(--rule); }
h3 { font-size: 19px; margin: 32px 0 10px; }
h4 { font-size: 17px; margin: 24px 0 8px; }
p { margin: 0 0 14px; }
a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
code { background: rgba(111, 78, 55, 0.08); padding: 1px 5px; border-radius: 3px; font-size: 0.9em; font-family: "SF Mono", Menlo, monospace; }
strong { font-weight: 700; }
em { font-style: italic; }
ul, ol { margin: 0 0 14px; padding-left: 1.4em; }
li { margin-bottom: 4px; }
table { width: 100%; border-collapse: collapse; margin: 14px 0 22px; font-size: 14px; }
th, td { border-bottom: 1px solid var(--rule); padding: 8px 10px; text-align: left; vertical-align: top; }
th { background: rgba(111, 78, 55, 0.06); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
td a { word-break: break-word; }
sup.fn-ref a, sup.footnote-ref a { color: var(--accent); text-decoration: none; font-size: 0.78em; padding: 0 1px; }
.footnotes { margin-top: 56px; padding-top: 24px; border-top: 2px solid var(--ink); font-size: 14px; color: var(--muted); }
.footnotes h2 { border-top: none; margin-top: 0; font-size: 18px; }
.footnotes ol { padding-left: 1.6em; }
.footnotes li { margin-bottom: 6px; }
.fn-back { margin-left: 4px; text-decoration: none; }

/* Site link — sits a couple lines under the title, typographically paired with it */
.site-link {
  margin: 28px 0 32px;
  font-family: Georgia, "Iowan Old Style", "Source Serif Pro", serif;
  font-size: 36px;
  line-height: 1.15;
  font-weight: 700;
}
.site-link a {
  color: #1a6cdb;
  text-decoration: underline;
  text-underline-offset: 4px;
}
.site-link a:hover { color: #0a4fa8; }

/* Related-content nav (link cards at the top of the report) */
.report-nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 28px; }
.report-nav a {
  flex: 1 1 160px;
  min-width: 140px;
  padding: 9px 13px 11px;
  background: color-mix(in srgb, var(--bg) 85%, var(--accent) 6%);
  border: 1px solid var(--rule);
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  text-decoration: none;
  color: var(--ink);
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}
.report-nav a:hover, .report-nav a:focus-visible {
  border-color: var(--accent);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  text-decoration: none;
  outline: none;
}
.report-nav .rn-eyebrow {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--accent); font-weight: 700;
}
.report-nav .rn-label {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px; font-weight: 600; color: var(--ink);
}

/* Print-specific (Save as PDF) */
@media print {
  body { background: white; font-size: 12pt; }
  .report { max-width: none; padding: 0; }
  .cover { max-height: 240px; }
  h2 { page-break-before: always; }
  h2:first-of-type { page-break-before: avoid; }
  a { color: var(--ink); text-decoration: none; }
  .footnotes { page-break-before: always; }
  .report-nav { display: none !important; }
  .site-link { display: none !important; }
}
"""

HTML_TMPL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title_esc}</title>
<style>{css}</style>
</head>
<body>
<article class="report">
  <header class="report-header">
    {eyebrow_html}
    <h1 class="title">{title_esc}</h1>
    {subtitle_html}
  </header>
  {site_link_html}
  {nav_html}
  {cover_html}
  {body_html}
</article>
</body>
</html>
"""


def _nav_html(app_url: str, storymap_url: str) -> str:
    """Render the two-card nav that sits above the cover. Hidden in print CSS."""
    links: list[tuple[str, str, str]] = []
    if app_url:
        links.append(("Explore", "Interactive map →", app_url))
    if storymap_url:
        links.append(("Watch", "Story map →", storymap_url))

    if not links:
        return ""

    items = "".join(
        f'<a href="{html.escape(href)}" target="_blank" rel="noopener">'
        f'<span class="rn-eyebrow">{html.escape(eb)}</span>'
        f'<span class="rn-label">{html.escape(lbl)}</span></a>'
        for eb, lbl, href in links
    )
    return f'<nav class="report-nav" aria-label="Related content">{items}</nav>'


def _site_link_html(home_url: str, label: str = "City Anatomy") -> str:
    """Render the small "City Anatomy" hyperlink at the very top. Hidden in print."""
    if not home_url:
        return ""
    return (
        f'<p class="site-link">'
        f'<a href="{html.escape(home_url)}">{html.escape(label)}</a>'
        f'</p>'
    )


def build(md_path: Path, out_path: Path, title: str, subtitle: str = "",
          eyebrow: str = "", cover_image: Path | None = None,
          app_url: str = "", storymap_url: str = "", home_url: str = "/") -> None:
    md_text = md_path.read_text(encoding="utf-8")

    # If the report begins with an H1, drop it (we render our own from --title)
    md_text = re.sub(r"^\s*#\s+.+\n+", "", md_text, count=1)

    # Perplexity reports use [^N] as inline source citations but list sources as
    # a plain numbered list at the end (no [^N]: defs). Convert the inline refs
    # to clean superscripts so they don't render as literal "[^1]" text.
    md_text = re.sub(r"\[\^(\d+)\]", r"<sup>\1</sup>", md_text)

    body_html = render_markdown(md_text)

    out_path.parent.mkdir(parents=True, exist_ok=True)

    cover_html = ""
    if cover_image and cover_image.exists():
        cover_dest = out_path.parent / cover_image.name
        if cover_image.resolve() != cover_dest.resolve():
            shutil.copy2(cover_image, cover_dest)
        cover_html = f'<img class="cover" src="{html.escape(cover_image.name)}" alt="" />'

    eyebrow_html = f'<p class="eyebrow">{html.escape(eyebrow)}</p>' if eyebrow else ""
    subtitle_html = f'<p class="subtitle">{html.escape(subtitle)}</p>' if subtitle else ""
    nav_html = _nav_html(app_url, storymap_url)
    site_link_html = _site_link_html(home_url)

    out = HTML_TMPL.format(
        title_esc=html.escape(title),
        eyebrow_html=eyebrow_html,
        subtitle_html=subtitle_html,
        site_link_html=site_link_html,
        nav_html=nav_html,
        cover_html=cover_html,
        body_html=body_html,
        css=CSS,
    )
    out_path.write_text(out, encoding="utf-8")
    print(f"Wrote {out_path} ({len(out):,} bytes)")


def main() -> int:
    p = argparse.ArgumentParser(description="Render Markdown to a print-friendly HTML report.")
    p.add_argument("--markdown", required=True, help="Source .md file")
    p.add_argument("--out", required=True, help="Output .html path")
    p.add_argument("--title", required=True)
    p.add_argument("--subtitle", default="")
    p.add_argument("--eyebrow", default="")
    p.add_argument("--cover-image", default="")
    p.add_argument("--slug", default="",
                   help="If set, derives --app-url=/apps/citywide/<slug>/ and --storymap-url=/storymaps/<slug>/.")
    p.add_argument("--app-url", default="", help="Override the Explore → app link.")
    p.add_argument("--storymap-url", default="", help="Override the Watch → storymap link.")
    p.add_argument("--home-url", default="/", help="Home link target (default: /).")
    args = p.parse_args()

    md_path = Path(args.markdown).resolve()
    out_path = Path(args.out).resolve()
    cover = Path(args.cover_image).resolve() if args.cover_image else None

    if not md_path.exists():
        print(f"ERROR: markdown file not found: {md_path}", file=sys.stderr)
        return 1

    app_url = args.app_url or (f"/apps/citywide/{args.slug}/" if args.slug else "")
    storymap_url = args.storymap_url or (f"/storymaps/{args.slug}/" if args.slug else "")

    build(md_path, out_path, args.title, args.subtitle, args.eyebrow, cover,
          app_url=app_url, storymap_url=storymap_url, home_url=args.home_url)
    return 0


if __name__ == "__main__":
    sys.exit(main())
