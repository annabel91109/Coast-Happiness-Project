"""Render markdown reports to PDF via Chrome headless.

Pandoc / wkhtmltopdf / weasyprint aren't installed locally, but Chrome
is — and `chrome --headless --print-to-pdf` is well-supported and
respects standard CSS, so we drive it from a small HTML wrapper.
"""
import subprocess
from pathlib import Path
import markdown

ROOT = Path("/Users/annabel/Downloads/Coast Happiness Project/reports")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

CSS = """
@page { size: A4; margin: 22mm 20mm; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  color: #1a1f23;
  font-size: 10.5pt;
  line-height: 1.5;
  max-width: 100%;
}
h1 { font-size: 20pt; margin: 0 0 4pt; color: #0d3d47; }
h2 { font-size: 14pt; margin: 22pt 0 6pt; color: #0d3d47;
     border-bottom: 1px solid #c8d6d8; padding-bottom: 3pt; }
h3 { font-size: 11.5pt; margin: 14pt 0 4pt; color: #145e6a; }
p, ul, ol { margin: 6pt 0; }
strong { color: #0d3d47; }
hr { border: none; border-top: 1px solid #c8d6d8; margin: 14pt 0; }
code {
  font-family: "SF Mono", Menlo, Consolas, monospace;
  background: #f4f6f7; padding: 1px 4px; border-radius: 3px;
  font-size: 0.92em;
}
pre {
  background: #f4f6f7; padding: 8pt 10pt; border-radius: 4px;
  overflow-x: auto; font-size: 9pt; line-height: 1.4;
}
pre code { background: none; padding: 0; }
table {
  border-collapse: collapse; margin: 8pt 0;
  font-size: 0.95em; width: 100%;
}
th, td { border: 1px solid #c8d6d8; padding: 4pt 8pt; text-align: left; }
th { background: #f0f7f6; color: #0d3d47; }
blockquote {
  border-left: 3px solid #5a9daa; padding: 2pt 10pt;
  margin: 8pt 0; color: #4a5b60; background: #f7fafb;
}
li { margin: 2pt 0; }
a { color: #145e6a; text-decoration: none; }
a:hover { text-decoration: underline; }
"""


def render(md_path):
    text = md_path.read_text(encoding="utf-8")
    html_body = markdown.markdown(
        text,
        extensions=["extra", "tables", "sane_lists", "fenced_code"],
    )
    html = (
        f"<!DOCTYPE html><html><head><meta charset='utf-8'>"
        f"<title>{md_path.stem}</title><style>{CSS}</style>"
        f"</head><body>{html_body}</body></html>"
    )
    html_path = md_path.with_suffix(".html")
    html_path.write_text(html, encoding="utf-8")

    pdf_path = md_path.with_suffix(".pdf")
    subprocess.run(
        [
            CHROME,
            "--headless=new",
            "--disable-gpu",
            "--no-pdf-header-footer",
            f"--print-to-pdf={pdf_path}",
            html_path.as_uri(),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    html_path.unlink()  # tidy up
    print(f"  {md_path.name} → {pdf_path.name} "
          f"({pdf_path.stat().st_size // 1024} KB)")


def main():
    for md in sorted(ROOT.glob("*.md")):
        render(md)


if __name__ == "__main__":
    main()
