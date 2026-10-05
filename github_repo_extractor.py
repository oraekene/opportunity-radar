#!/usr/bin/env python3
"""
GitHub Comprehensive Repository Extractor (Zero Dependencies)
==============================================================
Pure Python standard library implementation (urllib + zipfile + json).
No external packages or `pip install` required.

Capabilities:
  1. Personal Source Repositories (`--mode source-only` or `--mode all`):
     - Downloads full source tree in 1 efficient API call per repo (via zipball).
     - Filters out large files (> 20 MB by default, configurable via `--max-file-mb`).
     - Logs excluded large files to `skipped_large_files.json`.
     - Extracts complete commit history (`commits.json` & `commits_summary.md`).
     - Extracts complete issue & PR history with full comment threads (`issues.json`).
     - Preserves full repo metadata (`metadata.json`).

  2. Forked Repositories (`--mode forks-only` or `--mode all`):
     - Extracts README files directly from GitHub's `/readme` endpoint.
     - Preserves upstream origin metadata and generation timestamps.
     - Saves either as flat files or nested folders.

Usage:
  python github_repo_extractor.py --mode source-only --token ghp_xxxx
  python github_repo_extractor.py --mode forks-only
  python github_repo_extractor.py --mode all --max-file-mb 20 --resume
"""

import os
import sys
import io
import json
import time
import zipfile
import base64
import argparse
import urllib.request
import urllib.error
from pathlib import Path, PurePosixPath
from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any, List


# ══════════════════════════════════════════════════════════════════
# LOGGING & UTILS
# ══════════════════════════════════════════════════════════════════

def log(msg: str, level: str = "INFO"):
    ts = datetime.now().strftime("%H:%M:%S")
    symbols = {
        "INFO": "•",
        "OK": "✓",
        "WARN": "⚠",
        "ERR": "✗",
        "SKIP": "→",
    }
    sym = symbols.get(level, "•")
    print(f"  [{ts}] {sym} {msg}")


def safe_filename(name: str) -> str:
    """Sanitize repository or path names for filesystem safety."""
    return name.replace("/", "__").replace("\\", "__").replace(":", "_")


# ══════════════════════════════════════════════════════════════════
# ZERO-DEPENDENCY HTTP CLIENT WITH AUTH & REDIRECT HANDLING
# ══════════════════════════════════════════════════════════════════

class GitHubAuthRedirectHandler(urllib.request.HTTPRedirectHandler):
    """
    Ensures Authorization headers persist across redirects (e.g., api.github.com -> codeload.github.com)
    which is essential for downloading private repo archives.
    """
    def __init__(self, token: str):
        super().__init__()
        self.token = token

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new_req = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new_req and self.token:
            new_req.add_header("Authorization", f"Bearer {self.token}")
            new_req.add_header("User-Agent", "GitHub-Custom-Extractor/2.0")
        return new_req


def github_api_get(url: str, token: str, label: str = "", max_retries: int = 3, raw_bytes: bool = False) -> Tuple[Optional[Any], Dict[str, str], int]:
    """
    Executes a GitHub request with automated backoff, rate-limit sleep, and redirect handling.
    Returns (data_or_bytes, response_headers, status_code).
    """
    headers = {
        "User-Agent": "GitHub-Custom-Extractor/2.0",
        "Authorization": f"Bearer {token}",
    }
    if not raw_bytes:
        headers["Accept"] = "application/vnd.github.v3+json"
    else:
        headers["Accept"] = "application/vnd.github.v3.raw"

    opener = urllib.request.build_opener(GitHubAuthRedirectHandler(token))

    for attempt in range(1, max_retries + 1):
        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with opener.open(req, timeout=60) as resp:
                resp_headers = dict(resp.headers)
                data_bytes = resp.read()

                if raw_bytes:
                    return data_bytes, resp_headers, resp.status

                if not data_bytes:
                    return None, resp_headers, resp.status

                text = data_bytes.decode("utf-8", errors="replace")
                try:
                    parsed = json.loads(text)
                except json.JSONDecodeError:
                    parsed = text
                return parsed, resp_headers, resp.status

        except urllib.error.HTTPError as e:
            resp_headers = dict(e.headers)
            if e.code == 404:
                return None, resp_headers, 404

            if e.code in (403, 429):
                reset_val = resp_headers.get("x-ratelimit-reset") or resp_headers.get("X-RateLimit-Reset")
                remaining = resp_headers.get("x-ratelimit-remaining") or resp_headers.get("X-RateLimit-Remaining")

                if remaining == "0" and reset_val:
                    try:
                        wait_seconds = max(int(reset_val) - int(time.time()) + 2, 5)
                        log(f"Rate limit exhausted on '{label}'. Sleeping {wait_seconds}s …", "WARN")
                        time.sleep(wait_seconds)
                        continue
                    except ValueError:
                        pass

                log(f"Rate limited or forbidden ({e.code}) on '{label}'. Retrying in {5 * attempt}s …", "WARN")
                time.sleep(5 * attempt)
            else:
                if attempt == max_retries:
                    log(f"HTTP {e.code} error on '{label}': {e.reason}", "ERR")
                    return None, resp_headers, e.code
                time.sleep(3 * attempt)

        except Exception as e:
            if attempt == max_retries:
                log(f"Network error on '{label}': {e}", "ERR")
                return None, {}, 500
            time.sleep(2 * attempt)

    return None, {}, 500


# ══════════════════════════════════════════════════════════════════
# FEATURE 1: PERSONAL SOURCE REPO EXTRACTION
# ══════════════════════════════════════════════════════════════════

def extract_repo_commits(full_name: str, token: str, repo_dir: Path) -> List[Dict[str, Any]]:
    """Fetches full paginated commit history and produces commits.json & commits_summary.md."""
    log(f"  → Extracting commit history …", "INFO")
    commits: List[Dict[str, Any]] = []
    page = 1

    while True:
        url = f"https://api.github.com/repos/{full_name}/commits?per_page=100&page={page}"
        data, _, status = github_api_get(url, token, label=f"{full_name}/commits-p{page}")
        if not data or not isinstance(data, list):
            break

        for c in data:
            commit_info = c.get("commit", {})
            commits.append({
                "sha": c.get("sha"),
                "author": commit_info.get("author"),
                "committer": commit_info.get("committer"),
                "message": commit_info.get("message"),
                "html_url": c.get("html_url"),
                "parents": [p.get("sha") for p in c.get("parents", [])],
            })

        if len(data) < 100:
            break
        page += 1

    # Save full JSON
    (repo_dir / "commits.json").write_text(
        json.dumps(commits, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    # Save Markdown Changelog
    summary_lines = [
        f"# Commit History: {full_name}",
        f"Total Commits: {len(commits)}",
        "",
        "| Date | SHA | Author | Message |",
        "| :--- | :---: | :--- | :--- |",
    ]
    for c in commits:
        sha_short = (c.get("sha") or "")[:7]
        date_str = (c.get("author") or {}).get("date") or ""
        author_name = (c.get("author") or {}).get("name") or "Unknown"
        msg = (c.get("message") or "").split("\n")[0].replace("|", "\\|")
        html_url = c.get("html_url") or "#"
        summary_lines.append(f"| {date_str} | [`{sha_short}`]({html_url}) | {author_name} | {msg} |")

    (repo_dir / "commits_summary.md").write_text("\n".join(summary_lines) + "\n", encoding="utf-8")
    log(f"  ✓ {len(commits)} commits recorded", "OK")
    return commits


def extract_repo_issues(full_name: str, token: str, repo_dir: Path) -> List[Dict[str, Any]]:
    """Fetches full issue and pull-request history including nested comments."""
    log(f"  → Extracting issues and discussions …", "INFO")
    issues: List[Dict[str, Any]] = []
    page = 1

    while True:
        url = f"https://api.github.com/repos/{full_name}/issues?state=all&per_page=100&page={page}"
        data, _, status = github_api_get(url, token, label=f"{full_name}/issues-p{page}")
        if not data or not isinstance(data, list):
            break

        for item in data:
            is_pr = "pull_request" in item
            issue_num = item.get("number")
            comments_count = item.get("comments", 0)
            comments_data: List[Dict[str, Any]] = []

            # If issue has comments, fetch comments thread
            if comments_count > 0:
                c_url = f"https://api.github.com/repos/{full_name}/issues/{issue_num}/comments?per_page=100"
                c_data, _, c_status = github_api_get(c_url, token, label=f"{full_name}/issue#{issue_num}-comments")
                if c_data and isinstance(c_data, list):
                    for c in c_data:
                        comments_data.append({
                            "id": c.get("id"),
                            "user": (c.get("user") or {}).get("login"),
                            "created_at": c.get("created_at"),
                            "updated_at": c.get("updated_at"),
                            "body": c.get("body"),
                        })

            issues.append({
                "number": issue_num,
                "title": item.get("title"),
                "state": item.get("state"),
                "is_pull_request": is_pr,
                "user": (item.get("user") or {}).get("login"),
                "labels": [lbl.get("name") for lbl in item.get("labels", []) if isinstance(lbl, dict)],
                "created_at": item.get("created_at"),
                "updated_at": item.get("updated_at"),
                "closed_at": item.get("closed_at"),
                "body": item.get("body"),
                "comments_count": comments_count,
                "comments": comments_data,
                "html_url": item.get("html_url"),
            })

        if len(data) < 100:
            break
        page += 1

    (repo_dir / "issues.json").write_text(
        json.dumps(issues, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    log(f"  ✓ {len(issues)} issues/PRs recorded", "OK")
    return issues


def extract_repo_files_zip(full_name: str, default_branch: str, token: str, repo_dir: Path, max_bytes: int) -> Tuple[int, List[Dict[str, Any]]]:
    """
    Downloads repository archive via GitHub's zipball endpoint in 1 single call.
    Filters out any file larger than max_bytes (default 20MB).
    """
    code_dir = repo_dir / "code"
    code_dir.mkdir(parents=True, exist_ok=True)

    branch = default_branch or "main"
    url = f"https://api.github.com/repos/{full_name}/zipball/{branch}"
    log(f"  → Downloading repository source archive [{branch}] …", "INFO")

    zip_bytes, _, status = github_api_get(url, token, label=f"{full_name}/zipball", raw_bytes=True)

    if not zip_bytes or status != 200:
        log(f"Could not retrieve zipball archive (HTTP {status}).", "WARN")
        return 0, []

    saved_count = 0
    skipped_files: List[Dict[str, Any]] = []

    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
            # First item in GitHub zipball is root folder (e.g. 'owner-repo-commit/')
            root_prefix = ""
            for name in z.namelist():
                if "/" in name:
                    root_prefix = name.split("/")[0] + "/"
                    break

            for zinfo in z.infolist():
                if zinfo.is_dir():
                    continue

                rel_name = zinfo.filename
                if root_prefix and rel_name.startswith(root_prefix):
                    rel_name = rel_name[len(root_prefix):]

                if not rel_name:
                    continue

                file_size = zinfo.file_size
                if file_size > max_bytes:
                    size_mb = round(file_size / (1024 * 1024), 2)
                    log(f"  ⚠ Skipping large file (>20MB): {rel_name} ({size_mb} MB)", "WARN")
                    skipped_files.append({
                        "path": rel_name,
                        "size_bytes": file_size,
                        "size_mb": size_mb,
                        "reason": "Exceeded maximum file size threshold",
                    })
                    continue

                target_file = code_dir / rel_name
                target_file.parent.mkdir(parents=True, exist_ok=True)
                target_file.write_bytes(z.read(zinfo))
                saved_count += 1

    except Exception as e:
        log(f"Error unpacking repository archive for {full_name}: {e}", "ERR")

    # Record skipped files if any
    (repo_dir / "skipped_large_files.json").write_text(
        json.dumps({
            "threshold_bytes": max_bytes,
            "threshold_mb": round(max_bytes / (1024 * 1024), 2),
            "skipped_count": len(skipped_files),
            "files": skipped_files,
        }, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    log(f"  ✓ {saved_count} source files extracted to code/ (Skipped: {len(skipped_files)})", "OK")
    return saved_count, skipped_files


def run_source_repos_extraction(args, repos: List[Dict[str, Any]], token: str, root_out: Path):
    """Processes personal source projects (full code <= 20MB, commits, issues)."""
    source_dir = root_out / "source_repos"
    source_dir.mkdir(parents=True, exist_ok=True)

    max_bytes = int(args.max_file_mb * 1024 * 1024)

    print("\n" + "═" * 65)
    print("   Extracting Personal Source Projects")
    print(f"   Max File Size Cap : {args.max_file_mb} MB ({max_bytes:,} bytes)")
    print(f"   Commit History     : {'Skipped' if args.skip_commits else 'Enabled'}")
    print(f"   Issue History      : {'Skipped' if args.skip_issues else 'Enabled'}")
    print(f"   Code Download      : {'Skipped' if args.skip_code else 'Enabled'}")
    print("═" * 65)

    manifest = []
    total = len(repos)

    for idx, repo in enumerate(repos, start=1):
        full_name = repo.get("full_name", "")
        repo_name = repo.get("name", "")
        safe_name = safe_filename(full_name)
        default_branch = repo.get("default_branch") or "main"
        repo_dir = source_dir / safe_name
        repo_dir.mkdir(parents=True, exist_ok=True)

        print(f"\n[{idx}/{total}] Processing Source Project: {full_name}")

        # Check resume condition
        if args.resume and (repo_dir / "metadata.json").exists() and (repo_dir / "code").exists():
            log(f"Already extracted — skipping (--resume)", "SKIP")
            manifest.append({
                "full_name": full_name,
                "status": "skipped_resume",
                "repo_path": str(repo_dir.relative_to(root_out)),
            })
            continue

        # 1. Metadata
        meta = {
            "id": repo.get("id"),
            "full_name": full_name,
            "name": repo_name,
            "html_url": repo.get("html_url"),
            "default_branch": default_branch,
            "description": repo.get("description"),
            "language": repo.get("language"),
            "stargazers_count": repo.get("stargazers_count"),
            "forks_count": repo.get("forks_count"),
            "created_at": repo.get("created_at"),
            "updated_at": repo.get("updated_at"),
            "pushed_at": repo.get("pushed_at"),
            "visibility": repo.get("visibility", "public"),
        }
        (repo_dir / "metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

        # 2. Source Files (zipball with size cap)
        saved_files = 0
        skipped_large: List[Dict[str, Any]] = []
        if not args.skip_code:
            saved_files, skipped_large = extract_repo_files_zip(
                full_name, default_branch, token, repo_dir, max_bytes
            )

        # 3. Commits History
        commits_count = 0
        if not args.skip_commits:
            commits = extract_repo_commits(full_name, token, repo_dir)
            commits_count = len(commits)

        # 4. Issues & Comments
        issues_count = 0
        if not args.skip_issues:
            issues = extract_repo_issues(full_name, token, repo_dir)
            issues_count = len(issues)

        manifest.append({
            "full_name": full_name,
            "html_url": repo.get("html_url"),
            "default_branch": default_branch,
            "files_extracted": saved_files,
            "files_skipped_large": len(skipped_large),
            "commits_count": commits_count,
            "issues_count": issues_count,
            "repo_dir": str(repo_dir.relative_to(root_out)),
            "status": "extracted",
        })

    # Summary outputs
    (source_dir / "_index.json").write_text(
        json.dumps({
            "extracted_at": datetime.now(timezone.utc).isoformat(),
            "total_repos": total,
            "max_file_size_mb": args.max_file_mb,
            "manifest": manifest,
        }, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    summary_lines = [
        "# Personal Source Projects Catalog",
        f"Extraction Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"Max File Size Filter: {args.max_file_mb} MB",
        "",
        "| Project | Branch | Files | Skipped (>20MB) | Commits | Issues | Folder |",
        "| :--- | :---: | :---: | :---: | :---: | :---: | :--- |",
    ]
    for m in manifest:
        if m.get("status") == "skipped_resume":
            summary_lines.append(f"| `{m['full_name']}` | - | - | - | - | - | *(cached)* |")
        else:
            summary_lines.append(
                f"| [`{m['full_name']}`]({m.get('html_url', '#')}) "
                f"| `{m['default_branch']}` "
                f"| {m['files_extracted']} "
                f"| {m['files_skipped_large']} "
                f"| {m['commits_count']} "
                f"| {m['issues_count']} "
                f"| [`{m['repo_dir']}`]({m['repo_dir']}) |"
            )

    (source_dir / "SUMMARY.md").write_text("\n".join(summary_lines) + "\n", encoding="utf-8")
    log(f"Source projects catalog saved to {source_dir / 'SUMMARY.md'}", "OK")


# ══════════════════════════════════════════════════════════════════
# FEATURE 2: FORK READMES EXTRACTION
# ══════════════════════════════════════════════════════════════════

def run_fork_readmes_extraction(args, forks: List[Dict[str, Any]], token: str, root_out: Path):
    """Processes forked repositories, extracting READMEs and upstream origin headers."""
    forks_dir = root_out / "forks"
    forks_dir.mkdir(parents=True, exist_ok=True)

    print("\n" + "═" * 65)
    print("   Extracting Fork READMEs")
    print(f"   Format : {'Flat files' if args.flat else 'Nested subfolders'}")
    print("═" * 65)

    manifest = []
    success_count = 0
    missing_count = 0
    skipped_count = 0

    for idx, repo in enumerate(forks, start=1):
        full_name = repo.get("full_name", "")
        safe_name = safe_filename(full_name)
        pushed_at = repo.get("pushed_at")

        if args.flat:
            readme_filename = f"{safe_name}__README.md"
            target_file = forks_dir / readme_filename
        else:
            repo_folder = forks_dir / safe_name
            repo_folder.mkdir(parents=True, exist_ok=True)
            target_file = repo_folder / "README.md"

        if args.resume and target_file.exists():
            log(f"[{idx}/{len(forks)}] {full_name} -> already downloaded, skipping (--resume)", "SKIP")
            skipped_count += 1
            manifest.append({
                "full_name": full_name,
                "status": "skipped_resume",
                "file_path": str(target_file.relative_to(root_out)),
            })
            continue

        log(f"[{idx}/{len(forks)}] Fetching README: {full_name} …", "INFO")
        readme_url = f"https://api.github.com/repos/{full_name}/readme"
        readme_json, _, status = github_api_get(readme_url, token, label=f"{full_name}/readme")

        if not readme_json or status == 404:
            log(f"No README found for {full_name}", "WARN")
            missing_count += 1
            manifest.append({
                "full_name": full_name,
                "status": "no_readme",
                "file_path": None,
            })
            continue

        try:
            raw_b64 = readme_json.get("content", "").replace("\n", "").replace("\r", "")
            content = base64.b64decode(raw_b64).decode("utf-8", errors="replace")
        except Exception as e:
            content = f"<!-- Error decoding README: {e} -->"

        if not args.no_header:
            header = (
                f"<!--\n"
                f"FORK: {full_name}\n"
                f"URL: {repo.get('html_url')}\n"
                f"DESCRIPTION: {repo.get('description') or 'No description'}\n"
                f"EXTRACTED_AT: {datetime.now(timezone.utc).isoformat()}\n"
                f"-->\n\n"
            )
            content = header + content

        target_file.write_text(content, encoding="utf-8")
        success_count += 1
        log(f"Saved: {target_file.name} ({len(content.encode('utf-8'))} bytes)", "OK")

        manifest.append({
            "full_name": full_name,
            "html_url": repo.get("html_url"),
            "status": "extracted",
            "file_path": str(target_file.relative_to(root_out)),
            "size_bytes": len(content.encode("utf-8")),
            "pushed_at": pushed_at,
        })

    (forks_dir / "_index.json").write_text(
        json.dumps({
            "extracted_at": datetime.now(timezone.utc).isoformat(),
            "total_forks": len(forks),
            "successful": success_count,
            "missing_readme": missing_count,
            "skipped": skipped_count,
            "manifest": manifest,
        }, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    summary_lines = [
        "# Fork READMEs Catalog",
        f"Extraction Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "| Fork Repo | Status | Local File |",
        "| :--- | :---: | :--- |",
    ]
    for m in manifest:
        file_link = f"[{m['file_path']}]({m['file_path']})" if m.get("file_path") else "*(none)*"
        summary_lines.append(f"| [`{m['full_name']}`]({m.get('html_url', '#')}) | {m['status']} | {file_link} |")

    (forks_dir / "SUMMARY.md").write_text("\n".join(summary_lines) + "\n", encoding="utf-8")
    log(f"Fork READMEs catalog saved to {forks_dir / 'SUMMARY.md'}", "OK")


# ══════════════════════════════════════════════════════════════════
# MAIN ORCHESTRATOR
# ══════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Comprehensive GitHub Extractor (Source Projects + Fork READMEs) - Zero Dependencies",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--mode", "-m",
        choices=["source-only", "forks-only", "all"],
        default="source-only",
        help="Extraction mode: 'source-only' (personal projects), 'forks-only' (fork READMEs), or 'all' (default: source-only)",
    )
    parser.add_argument(
        "--token", "-t",
        default="",
        help="GitHub Personal Access Token (or set GITHUB_TOKEN environment variable)",
    )
    parser.add_argument(
        "--output", "-o",
        default="github_export",
        help="Root output directory (default: ./github_export)",
    )
    parser.add_argument(
        "--max-file-mb",
        type=float,
        default=20.0,
        help="Maximum file size in MB to download for source project files (default: 20.0 MB)",
    )
    parser.add_argument(
        "--skip-commits",
        action="store_true",
        help="Skip extracting commit history for source projects.",
    )
    parser.add_argument(
        "--skip-issues",
        action="store_true",
        help="Skip extracting issues & comments for source projects.",
    )
    parser.add_argument(
        "--skip-code",
        action="store_true",
        help="Skip downloading code files (metadata + history only).",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip repositories or files already extracted.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limit number of repositories processed per mode (0 = all, great for testing).",
    )
    parser.add_argument(
        "--flat",
        action="store_true",
        default=True,
        help="For forks: Save as flat files owner__repo__README.md (default: True).",
    )
    parser.add_argument(
        "--nested",
        action="store_false",
        dest="flat",
        help="For forks: Save in nested subfolders owner__repo/README.md.",
    )
    parser.add_argument(
        "--no-header",
        action="store_true",
        help="For forks: Do not prepend metadata comment header to READMEs.",
    )

    args = parser.parse_args()
    token = (args.token or os.environ.get("GITHUB_TOKEN", "")).strip()

    if not token:
        print("\n❌ Error: No GitHub Personal Access Token provided.")
        print("   Supply it via `--token <YOUR_TOKEN>` or set the `GITHUB_TOKEN` environment variable.")
        print("   Example:")
        print("     $env:GITHUB_TOKEN = \"ghp_yourTokenHere\"")
        print("     python github_repo_extractor.py --mode source-only\n")
        sys.exit(1)

    root_out = Path(args.output).resolve()
    root_out.mkdir(parents=True, exist_ok=True)

    print("\n" + "═" * 65)
    print("   GitHub Repository & History Extractor (Zero Dependencies)")
    print("═" * 65)

    # Validate Auth
    user_data, user_headers, status = github_api_get("https://api.github.com/user", token, label="auth check")
    if not user_data or status != 200:
        print(f"\n❌ Authentication failed (HTTP {status}). Please check your token permissions.")
        sys.exit(1)

    login = user_data.get("login", "unknown")
    remaining_limit = user_headers.get("x-ratelimit-remaining", user_headers.get("X-RateLimit-Remaining", "unknown"))
    total_limit = user_headers.get("x-ratelimit-limit", user_headers.get("X-RateLimit-Limit", "unknown"))

    print(f"  User Account  : @{login}")
    print(f"  API Quota     : {remaining_limit}/{total_limit} calls remaining")
    print(f"  Target Mode   : {args.mode}")
    print(f"  Output Root   : {root_out}")
    print("─" * 65)

    # Fetch All Owned Repositories
    log("Discovering user repositories …", "INFO")
    all_repos = []
    page = 1
    while True:
        url = f"https://api.github.com/user/repos?type=owner&per_page=100&page={page}"
        repos_data, _, status = github_api_get(url, token, label=f"repos-page-{page}")
        if not repos_data or not isinstance(repos_data, list):
            break

        all_repos.extend(repos_data)
        if len(repos_data) < 100:
            break
        page += 1

    source_repos = [r for r in all_repos if not r.get("fork", False)]
    fork_repos = [r for r in all_repos if r.get("fork", False)]

    log(f"Found {len(source_repos)} personal source projects and {len(fork_repos)} forked repositories.", "OK")

    if args.limit and args.limit > 0:
        source_repos = source_repos[:args.limit]
        fork_repos = fork_repos[:args.limit]
        print(f"  Applying limit: processing max {args.limit} repos per mode.\n")

    start_total = time.time()

    # Execute Selected Modes
    if args.mode in ("source-only", "all"):
        if source_repos:
            run_source_repos_extraction(args, source_repos, token, root_out)
        else:
            log("No personal source projects found.", "WARN")

    if args.mode in ("forks-only", "all"):
        if fork_repos:
            run_fork_readmes_extraction(args, fork_repos, token, root_out)
        else:
            log("No forked repositories found.", "WARN")

    elapsed_total = round(time.time() - start_total, 1)

    print("\n" + "═" * 65)
    print(f"  All tasks finished in {elapsed_total}s!")
    print(f"  📁 Output Root: {root_out}")
    print("═" * 65 + "\n")


if __name__ == "__main__":
    main()
