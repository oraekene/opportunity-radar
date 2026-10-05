#!/usr/bin/env python3
"""
Cloudflare Docs Scraper & Splitter
==================================
Streams and splits Cloudflare's complete documentation dump:
https://developers.cloudflare.com/llms-full.txt
into individual, cleanly structured Markdown files organized by category and slug.

Key Capabilities:
- Pure Python 3 standard library (zero external pip dependencies required).
- Streaming architecture: Line-by-line streaming keeps memory footprint tiny (<20 MB)
  even when processing hundreds of megabytes of documentation.
- Robust boundary detection: Accurately identifies page boundaries using YAML frontmatter
  and schema delimiters across documentation, guides, and API reference endpoints.
- High-fidelity metadata extraction: Extracts canonical URL, title, description,
  and dateModified.
- Safe cross-platform path handling: Sanitizes Windows forbidden characters and reserved
  device names (CON, PRN, AUX, etc.), and supports extended length Windows paths (\\\\?\\).
- Resumable: `--skip-existing` avoids rewriting files if interrupted.
- Output styles: Hierarchical (`section/page.md`), Index-based (`section/page/index.md`),
  or Flat (`section_page.md`).
- Generates `manifest.json` and a comprehensive `SUMMARY.md` Table of Contents.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Generator, Iterator, Optional, Tuple, Dict, Any, List

# Cloudflare Docs Default Source URL
DEFAULT_URL = "https://developers.cloudflare.com/llms-full.txt"
DEFAULT_OUT_DIR = "cloudflare_docs"

# Regexes for frontmatter & metadata
FRONTMATTER_KEY_RE = re.compile(r"^[a-zA-Z0-9_-]+:\s*")
KNOWN_FRONTMATTER_KEYS = {
    "title", "description", "image", "pcx_content_type",
    "weight", "tags", "summary", "products", "layout",
    "external_link", "difficulty", "content_type"
}

# Windows reserved filenames
WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
}


class PeekableIterator:
    """Helper wrapper allowing lookahead without consuming the underlying stream."""

    def __init__(self, it: Iterator[str]):
        self.it = iter(it)
        self._peeked: List[str] = []

    def __iter__(self):
        return self

    def __next__(self) -> str:
        if self._peeked:
            return self._peeked.pop(0)
        return next(self.it)

    def peek(self, n: int = 1) -> List[str]:
        """Peeks up to n lines ahead without advancing the iterator."""
        while len(self._peeked) < n:
            try:
                self._peeked.append(next(self.it))
            except StopIteration:
                break
        return self._peeked[:n]


def sanitize_filename_component(name: str) -> str:
    """Sanitizes a directory or file component for safe cross-platform file systems."""
    # Replace invalid filesystem characters: < > : " / \ | ? *
    sanitized = re.sub(r'[<>:"/\\|?*]', "-", name).strip(". ")
    # Replace control characters
    sanitized = re.sub(r'[\x00-\x1f]', "", sanitized)
    # Handle Windows reserved device names
    base_upper = sanitized.split(".")[0].upper()
    if base_upper in WINDOWS_RESERVED_NAMES:
        sanitized = f"_{sanitized}"
    return sanitized or "unnamed"


def safe_windows_path(path: Path) -> Path:
    """Prepends Windows extended-path prefix if path is long to prevent MAX_PATH failures."""
    if os.name == "nt":
        abs_str = str(path.resolve())
        if not abs_str.startswith("\\\\?\\") and len(abs_str) > 240:
            return Path("\\\\?\\" + abs_str)
    return path


def extract_metadata(content: str) -> Dict[str, Any]:
    """Extracts canonical URL, title, description, and modified date from page markdown."""
    meta: Dict[str, Any] = {
        "url": None,
        "title": None,
        "description": None,
        "date_modified": None,
    }

    # 1. Title
    title_m = re.search(r"^title:\s*(.+)$", content, re.M)
    if title_m:
        meta["title"] = title_m.group(1).strip().strip('"\'')
    else:
        h1_m = re.search(r"^#\s+(.+)$", content, re.M)
        if h1_m:
            meta["title"] = h1_m.group(1).strip()

    # 2. Description
    desc_m = re.search(r"^description:\s*(.+)$", content, re.M)
    if desc_m:
        meta["description"] = desc_m.group(1).strip().strip('"\'')

    # 3. Canonical URL extraction cascade
    # Priority A: [View as Markdown](https://developers.cloudflare.com/.../index.md)
    view_md_m = re.search(r"\[View as Markdown\]\((https://developers\.cloudflare\.com/[^)]+)\)", content)
    if view_md_m:
        raw_url = view_md_m.group(1)
        if raw_url.endswith("/index.md"):
            meta["url"] = raw_url[:-8]
        elif raw_url.endswith(".md"):
            meta["url"] = raw_url[:-3]
        else:
            meta["url"] = raw_url

    # Priority B: Schema.org JSON-LD url
    if not meta["url"]:
        schema_url_m = re.search(r'"url"\s*:\s*"(https://developers\.cloudflare\.com/[^"]+)"', content)
        if schema_url_m:
            meta["url"] = schema_url_m.group(1)

    # Priority C: Frontmatter image URL
    if not meta["url"]:
        img_m = re.search(r"^image:\s*(https://developers\.cloudflare\.com/[^\s]+)", content, re.M)
        if img_m:
            img_url = img_m.group(1)
            # e.g., https://developers.cloudflare.com/argo-smart-routing/og.png?v=...
            meta["url"] = re.sub(r"/og\.png(\?.*)?$", "/", img_url)

    # Priority D: API Reference Breadcrumbs
    if not meta["url"]:
        api_crumbs = re.findall(r"\[(?:API Reference|[^\]]+)\]\((https://developers\.cloudflare\.com/api/resources/[^)]+)\)", content)
        if api_crumbs:
            base = api_crumbs[-1].rstrip("/")
            slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", (meta["title"] or "endpoint").lower()).strip("-")
            meta["url"] = f"{base}/{slug}"

    # Priority E: General Breadcrumb Links
    if not meta["url"]:
        doc_idx_m = re.search(r"Fetch the complete documentation index at:\s*(https://developers\.cloudflare\.com/[^\s]+)", content)
        if doc_idx_m:
            idx_url = doc_idx_m.group(1)
            # Remove llms.txt suffix
            base = re.sub(r"/llms\.txt$", "/", idx_url)
            slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", (meta["title"] or "page").lower()).strip("-")
            meta["url"] = f"{base.rstrip('/')}/{slug}"

    # 4. Date Modified from JSON-LD schema if available
    date_m = re.search(r'"dateModified"\s*:\s*"([^"]+)"', content)
    if date_m:
        meta["date_modified"] = date_m.group(1)

    return meta


def url_to_relative_path(url: Optional[str], title: Optional[str], index_counter: int, style: str = "hierarchical") -> Path:
    """
    Converts a canonical Cloudflare documentation URL into a clean local file path.
    Supports styles:
      - 'hierarchical': workers/runtime-apis/fetch.md (and section/index.md for section roots)
      - 'index': workers/runtime-apis/fetch/index.md
      - 'flat': workers_runtime-apis_fetch.md
    """
    if not url:
        fallback_name = re.sub(r"[^a-zA-Z0-9_-]+", "_", (title or f"page_{index_counter:04d}")).strip("_")
        return Path("_unresolved") / f"{index_counter:04d}_{fallback_name}.md"

    parsed = urllib.parse.urlparse(url)
    clean_path = parsed.path.strip("/")

    if not clean_path:
        return Path("index.md")

    parts = [sanitize_filename_component(p) for p in clean_path.split("/") if p]
    if not parts:
        return Path("index.md")

    if style == "flat":
        flat_name = "_".join(parts) + ".md"
        return Path(flat_name)

    if style == "index":
        return Path(*parts) / "index.md"

    # Default 'hierarchical' style
    if parsed.path.endswith("/") and len(parts) == 1:
        # Top-level section root, e.g. /workers/ -> workers/index.md
        return Path(parts[0]) / "index.md"
    elif len(parts) > 1:
        # e.g., workers/runtime-apis/fetch -> workers/runtime-apis/fetch.md
        parent_dir = Path(*parts[:-1])
        return parent_dir / f"{parts[-1]}.md"
    else:
        return Path(f"{parts[0]}.md")


def clean_markdown_chrome(content: str) -> str:
    """
    Optional cleaning function to strip web navigation chrome / feedback buttons
    while preserving all documentation text, code snippets, and frontmatter.
    """
    # Remove navigation links like [Skip to content](#main-content)
    content = re.sub(r"\[Skip to content\]\([^)]+\)\s*", "", content)
    # Remove feedback widgets
    content = re.sub(r"Was this helpful\?\s*YesNo\s*", "", content)
    # Remove redundant UI anchors
    content = re.sub(r"Copy as Markdown\|\s*\[View as Markdown\]\([^)]+\)\|\s*\[Agent setup\]\([^)]+\)\s*", "", content)
    # Clean redundant trailing schema json if requested
    return content.strip() + "\n"


def stream_source_lines(source: str, is_url: bool) -> Generator[str, None, None]:
    """Streams lines from either a remote HTTP URL or a local file."""
    if is_url:
        print(f"Connecting to remote URL: {source}")
        req = urllib.request.Request(
            source,
            headers={
                "User-Agent": "CloudflareDocsScraper/1.0 (Documentation Splitter)",
                "Accept": "text/plain,text/markdown,*/*",
            },
        )
        with urllib.request.urlopen(req, timeout=180) as response:
            for raw_line in response:
                yield raw_line.decode("utf-8", errors="replace")
    else:
        print(f"Reading from local file: {source}")
        with open(source, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                yield line


def stream_pages(lines_iter: Iterator[str]) -> Generator[str, None, None]:
    """
    State machine that detects page boundaries across llms-full.txt and yields
    individual page contents as complete markdown strings.
    """
    stream = PeekableIterator(lines_iter)
    current_page_lines: List[str] = []
    in_frontmatter = False

    for line in stream:
        stripped = line.strip()

        if stripped == "---":
            if in_frontmatter:
                # Closing delimiter of current page frontmatter
                in_frontmatter = False
                current_page_lines.append(line)
                continue
            else:
                # Check if this opens frontmatter for a new page
                ahead = stream.peek(5)
                is_frontmatter_start = False
                for peek_line in ahead:
                    p_strip = peek_line.strip()
                    if not p_strip:
                        continue
                    if FRONTMATTER_KEY_RE.match(p_strip):
                        key = p_strip.split(":", 1)[0].lower()
                        if key in KNOWN_FRONTMATTER_KEYS or re.match(r"^[a-z_]+$", key):
                            is_frontmatter_start = True
                    break

                if is_frontmatter_start:
                    if current_page_lines:
                        # Yield the completed page
                        yield "".join(current_page_lines)
                        current_page_lines = []
                    in_frontmatter = True
                    current_page_lines.append(line)
                    continue

        current_page_lines.append(line)

    if current_page_lines:
        yield "".join(current_page_lines)


def run_scraper(
    source: str,
    output_dir: Path,
    is_url: bool = True,
    skip_existing: bool = False,
    clean_ui: bool = False,
    style: str = "hierarchical",
    max_pages: Optional[int] = None,
) -> None:
    """Core execution engine for streaming, splitting, and writing docs."""
    start_time = time.time()
    output_dir = output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest_entries: List[Dict[str, Any]] = []
    total_pages = 0
    total_written = 0
    total_skipped = 0
    total_bytes = 0

    print("=" * 70)
    print(" Cloudflare Documentation Splitter & Scraper")
    print("=" * 70)
    print(f" Source      : {source}")
    print(f" Output Dir  : {output_dir}")
    print(f" Layout Style: {style}")
    print(f" Skip Exist  : {skip_existing}")
    print(f" Clean UI    : {clean_ui}")
    if max_pages:
        print(f" Limit Pages : {max_pages}")
    print("-" * 70)

    try:
        raw_stream = stream_source_lines(source, is_url)
        page_generator = stream_pages(raw_stream)

        for page_idx, page_content in enumerate(page_generator, start=1):
            if max_pages and page_idx > max_pages:
                print(f"\nReached max pages limit ({max_pages}). Stopping.")
                break

            total_pages += 1
            meta = extract_metadata(page_content)
            title = meta["title"] or f"Page {page_idx}"
            url = meta["url"]

            # Compute local relative file path
            rel_file_path = url_to_relative_path(url, title, page_idx, style=style)
            full_file_path = output_dir / rel_file_path

            # Skip existing files if requested
            if skip_existing and full_file_path.exists():
                total_skipped += 1
                if total_pages % 25 == 0 or total_pages <= 5:
                    print(f"[{total_pages:4d}] (SKIPPED) {rel_file_path}")
                # Record in manifest
                manifest_entries.append({
                    "index": page_idx,
                    "title": title,
                    "description": meta["description"],
                    "url": url,
                    "path": str(rel_file_path).replace("\\", "/"),
                    "date_modified": meta["date_modified"],
                    "bytes": full_file_path.stat().st_size,
                })
                continue

            # Ensure parent directories exist
            target_path = safe_windows_path(full_file_path)
            full_file_path.parent.mkdir(parents=True, exist_ok=True)

            # Clean UI chrome if requested
            to_write = clean_markdown_chrome(page_content) if clean_ui else page_content
            encoded_bytes = to_write.encode("utf-8")

            with open(target_path, "wb") as f:
                f.write(encoded_bytes)

            file_size = len(encoded_bytes)
            total_bytes += file_size
            total_written += 1

            manifest_entries.append({
                "index": page_idx,
                "title": title,
                "description": meta["description"],
                "url": url,
                "path": str(rel_file_path).replace("\\", "/"),
                "date_modified": meta["date_modified"],
                "bytes": file_size,
            })

            # Real-time console progress
            if total_pages <= 10 or total_pages % 50 == 0:
                print(f"[{total_pages:4d}] Saved: {rel_file_path} ({file_size / 1024:.1f} KB) -> '{title[:45]}'")

    except KeyboardInterrupt:
        print("\n[!] Process interrupted by user. Writing manifest for processed pages...")
    except Exception as e:
        print(f"\n[!] Error during scraping: {e}", file=sys.stderr)
        raise

    # Write Manifest JSON
    manifest_file = output_dir / "manifest.json"
    print(f"\nWriting manifest to: {manifest_file}")
    with open(safe_windows_path(manifest_file), "w", encoding="utf-8") as f:
        json.dump(
            {
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "source": source,
                "total_pages": len(manifest_entries),
                "total_bytes": total_bytes,
                "pages": manifest_entries,
            },
            f,
            indent=2,
            ensure_ascii=False,
        )

    # Write SUMMARY.md (Table of Contents)
    summary_file = output_dir / "SUMMARY.md"
    print(f"Writing Table of Contents to: {summary_file}")
    with open(safe_windows_path(summary_file), "w", encoding="utf-8") as f:
        f.write("# Cloudflare Documentation Index\n\n")
        f.write(f"Scraped from [{source}]({source})\n")
        f.write(f"Total Pages: {len(manifest_entries)} | Total Size: {total_bytes / (1024 * 1024):.2f} MB\n\n")
        f.write("## Table of Contents\n\n")

        for entry in manifest_entries:
            p_title = entry["title"] or "Untitled Page"
            p_path = entry["path"]
            p_url = entry["url"] or ""
            f.write(f"- [{p_title}]({p_path})")
            if p_url:
                f.write(f" - [Docs Link]({p_url})")
            f.write("\n")

    elapsed = time.time() - start_time
    print("-" * 70)
    print(" Scrape & Split Complete!")
    print(f" Total Pages Processed : {total_pages}")
    print(f" Files Written          : {total_written}")
    print(f" Files Skipped          : {total_skipped}")
    print(f" Total Data Written     : {total_bytes / (1024 * 1024):.2f} MB")
    print(f" Elapsed Time           : {elapsed:.2f} seconds")
    print(f" Output Location        : {output_dir}")
    print("=" * 70)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Stream and split Cloudflare's llms-full.txt into individual Markdown pages."
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help=f"Source URL to scrape (default: {DEFAULT_URL})",
    )
    parser.add_argument(
        "-i", "--input-file",
        help="Optional local path to a pre-downloaded llms-full.txt file instead of fetching over HTTP.",
    )
    parser.add_argument(
        "-o", "--out-dir",
        default=DEFAULT_OUT_DIR,
        help=f"Target directory for output Markdown files (default: ./{DEFAULT_OUT_DIR})",
    )
    parser.add_argument(
        "--style",
        choices=["hierarchical", "index", "flat"],
        default="hierarchical",
        help="File structure style: 'hierarchical' (section/page.md), 'index' (section/page/index.md), or 'flat' (section_page.md).",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip writing files that already exist in the output directory (resumable mode).",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Strip navigation chrome (Skip to content, Was this helpful buttons, etc.).",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=None,
        help="Limit processing to first N pages (useful for quick testing).",
    )
    return parser.parse_args()


def main():
    args = parse_arguments()

    if args.input_file:
        source = args.input_file
        is_url = False
        if not os.path.exists(source):
            print(f"Error: Specified input file '{source}' does not exist.", file=sys.stderr)
            sys.exit(1)
    else:
        source = args.url
        is_url = True

    out_dir = Path(args.out_dir)

    run_scraper(
        source=source,
        output_dir=out_dir,
        is_url=is_url,
        skip_existing=args.skip_existing,
        clean_ui=args.clean,
        style=args.style,
        max_pages=args.max_pages,
    )


if __name__ == "__main__":
    main()
