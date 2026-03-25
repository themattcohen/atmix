"""Content scoring: local validation (supplementary)."""

import json
import re
import subprocess
from pathlib import Path

ENGINE_ROOT = Path(__file__).resolve().parent.parent


def md_to_html(markdown: str) -> str:
    """Convert markdown to basic HTML for Surfer injection."""
    text = markdown.strip()

    # Strip frontmatter
    text = re.sub(r'^---\s*\n.*?\n---\s*\n', '', text, flags=re.DOTALL)

    lines = text.split('\n')
    html_parts = []
    in_ul = False
    in_ol = False
    in_table = False
    table_rows = []

    def close_list():
        nonlocal in_ul, in_ol
        parts = []
        if in_ul:
            parts.append('</ul>')
            in_ul = False
        if in_ol:
            parts.append('</ol>')
            in_ol = False
        return parts

    def close_table():
        nonlocal in_table, table_rows
        if not in_table or not table_rows:
            return []
        parts = ['<table>']
        for i, row in enumerate(table_rows):
            cells = [c.strip() for c in row.split('|') if c.strip()]
            if i == 1 and all(set(c.strip()) <= {'-', ':'} for c in cells):
                continue  # Skip separator row
            tag = 'th' if i == 0 else 'td'
            parts.append('<tr>' + ''.join(f'<{tag}>{c}</{tag}>' for c in cells) + '</tr>')
        parts.append('</table>')
        in_table = False
        table_rows = []
        return parts

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Empty line — close lists/tables, skip
        if not stripped:
            html_parts.extend(close_list())
            html_parts.extend(close_table())
            i += 1
            continue

        # Table row
        if '|' in stripped and stripped.startswith('|'):
            html_parts.extend(close_list())
            if not in_table:
                in_table = True
                table_rows = []
            table_rows.append(stripped.strip('|'))
            i += 1
            continue
        else:
            html_parts.extend(close_table())

        # Headings
        heading_match = re.match(r'^(#{1,6})\s+(.+)$', stripped)
        if heading_match:
            html_parts.extend(close_list())
            level = len(heading_match.group(1))
            content = _inline_format(heading_match.group(2))
            html_parts.append(f'<h{level}>{content}</h{level}>')
            i += 1
            continue

        # Unordered list
        if re.match(r'^[-*+]\s+', stripped):
            html_parts.extend(close_table())
            if in_ol:
                html_parts.extend(close_list())
            if not in_ul:
                html_parts.append('<ul>')
                in_ul = True
            content = _inline_format(re.sub(r'^[-*+]\s+', '', stripped))
            html_parts.append(f'<li>{content}</li>')
            i += 1
            continue

        # Ordered list
        ol_match = re.match(r'^\d+\.\s+(.+)$', stripped)
        if ol_match:
            html_parts.extend(close_table())
            if in_ul:
                html_parts.extend(close_list())
            if not in_ol:
                html_parts.append('<ol>')
                in_ol = True
            content = _inline_format(ol_match.group(1))
            html_parts.append(f'<li>{content}</li>')
            i += 1
            continue

        # Regular paragraph
        html_parts.extend(close_list())
        content = _inline_format(stripped)
        html_parts.append(f'<p>{content}</p>')
        i += 1

    html_parts.extend(close_list())
    html_parts.extend(close_table())

    return '\n'.join(html_parts)


def _inline_format(text: str) -> str:
    """Apply inline markdown formatting: bold, italic, links."""
    # Links: [text](url)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
    # Bold: **text**
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    # Italic: *text*
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    return text


def run_local_validation(slug: str, config_path: str | None = None) -> dict:
    """Run validate-article.mjs and return parsed results."""
    result = {"passed": False, "checks": {}, "warnings": [], "failed": [], "error": None}

    cmd = ["node", str(ENGINE_ROOT / "scripts" / "validate-article.mjs"), slug]
    if config_path:
        cmd.extend(["--config", config_path])

    try:
        proc = subprocess.run(
            cmd,
            cwd=str(ENGINE_ROOT),
            capture_output=True,
            text=True,
            timeout=30,
        )

        # Parse the validation JSON output file
        report_path = ENGINE_ROOT / "output" / slug / "article.validation.json"
        if report_path.exists():
            report = json.loads(report_path.read_text(encoding="utf-8"))
            result["passed"] = report.get("passed", False)
            result["checks"] = report.get("checks", {})
            result["warnings"] = report.get("warnings", [])
            result["failed"] = report.get("failedChecks", [])
        else:
            result["error"] = f"Validation report not found. stdout: {proc.stdout[:500]}"
            if proc.returncode != 0:
                result["error"] += f"\nstderr: {proc.stderr[:500]}"
    except subprocess.TimeoutExpired:
        result["error"] = "Validation script timed out after 30s"
    except FileNotFoundError:
        result["error"] = "Node.js not found. Install Node.js to run validation."
    except Exception as e:
        result["error"] = str(e)

    return result
