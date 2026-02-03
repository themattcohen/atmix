"""Data Engineer Agent - LLM-powered custom data transformations.

This agent receives high-level data engineering tasks and writes
custom Python code to accomplish them. It enables the orchestrator
to request arbitrary derived data without predefined strategy types.

Example tasks:
- "Create a customer revenue breakdown from the GL by extracting unique
   values from the customer column and summing revenue"
- "Build a monthly cash flow summary from the bank transactions"
- "Extract all transactions over $10,000 with their descriptions"
"""

import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from rich.console import Console

# Try to import anthropic
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

console = Console()


class DataEngineerAgent:
    """Agent that writes and executes custom Python code for data engineering tasks.

    The orchestrator LLM identifies what derived data is needed and describes the task.
    This agent writes Python code to accomplish the task, executes it safely,
    and returns the path to the derived output file.
    """

    MODEL = "claude-sonnet-4-20250514"  # Sonnet for code generation (fast, good at code)
    MAX_RETRIES = 2
    TIMEOUT_SECONDS = 60  # Max execution time for generated code

    def __init__(self, workspace: Path):
        """Initialize the data engineer agent.

        Args:
            workspace: Path to the workspace directory
        """
        self.workspace = workspace
        self.input_path = workspace / "input"
        self.cleaned_path = workspace / "cleaned"
        self.derived_path = workspace / "derived"
        self.client = None
        self.total_tokens = 0

    def _init_client(self) -> bool:
        """Initialize Anthropic client."""
        if not ANTHROPIC_AVAILABLE:
            return False
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            return False
        self.client = anthropic.Anthropic(api_key=api_key)
        return True

    def execute_task(
        self,
        task_description: str,
        source_files: List[str],
        output_filename: str,
        file_samples: Optional[Dict[str, str]] = None,
    ) -> Optional[Path]:
        """Execute a custom data engineering task.

        Args:
            task_description: Natural language description of what to create
            source_files: List of source filenames to work with
            output_filename: Desired output filename
            file_samples: Optional dict of filename -> sample CSV data

        Returns:
            Path to the output file, or None if failed
        """
        if not self._init_client():
            console.print("  [red]✗[/red] Could not initialize Anthropic client")
            return None

        # Ensure derived path exists
        self.derived_path.mkdir(parents=True, exist_ok=True)

        # Gather file information
        file_info = self._gather_file_info(source_files, file_samples)
        if not file_info:
            console.print("  [red]✗[/red] Could not gather file information")
            return None

        # Generate code
        code = self._generate_code(task_description, file_info, output_filename)
        if not code:
            console.print("  [red]✗[/red] Could not generate code")
            return None

        # Execute code with retries
        for attempt in range(self.MAX_RETRIES + 1):
            success, error = self._execute_code(code, output_filename)
            if success:
                output_path = self.derived_path / output_filename
                if output_path.exists():
                    return output_path
                else:
                    console.print(f"  [yellow]⚠[/yellow] Code ran but output not created")
                    return None

            # Try to fix the code based on the error
            if attempt < self.MAX_RETRIES:
                console.print(f"  [yellow]⚠[/yellow] Execution failed, attempting fix ({attempt + 1}/{self.MAX_RETRIES})")
                code = self._fix_code(code, error, file_info, output_filename)
                if not code:
                    break

        console.print(f"  [red]✗[/red] Failed after {self.MAX_RETRIES + 1} attempts")
        return None

    def _gather_file_info(
        self,
        source_files: List[str],
        file_samples: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Dict[str, Any]]:
        """Gather information about source files for code generation.

        Args:
            source_files: List of source filenames
            file_samples: Optional pre-computed samples

        Returns:
            Dict of filename -> {path, columns, sample, dtypes}
        """
        file_info = {}

        for filename in source_files:
            # Find the file
            file_path = self._find_file(filename)
            if not file_path:
                console.print(f"  [yellow]⚠[/yellow] Could not find: {filename}")
                continue

            try:
                # Read file based on extension
                if file_path.suffix.lower() in ['.xlsx', '.xls']:
                    df = pd.read_excel(file_path)
                else:
                    df = pd.read_csv(file_path)

                info = {
                    "path": str(file_path),
                    "columns": list(df.columns),
                    "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
                    "row_count": len(df),
                }

                # Use provided sample or generate one
                if file_samples and filename in file_samples:
                    info["sample"] = file_samples[filename]
                else:
                    info["sample"] = df.head(10).to_csv(index=False)

                file_info[filename] = info

            except Exception as e:
                console.print(f"  [yellow]⚠[/yellow] Could not read {filename}: {e}")

        return file_info

    def _generate_code(
        self,
        task_description: str,
        file_info: Dict[str, Dict[str, Any]],
        output_filename: str,
    ) -> Optional[str]:
        """Generate Python code for the data engineering task.

        Args:
            task_description: What to accomplish
            file_info: Information about source files
            output_filename: Desired output filename

        Returns:
            Python code string or None
        """
        # Build file descriptions for prompt
        file_descriptions = []
        for filename, info in file_info.items():
            desc = f"""
### {filename}
- Path: {info['path']}
- Columns: {', '.join(info['columns'])}
- Row count: {info['row_count']:,}
- Sample data:
```csv
{info['sample']}
```
"""
            file_descriptions.append(desc)

        prompt = f"""You are a data engineer writing Python code to transform financial data.

## Task
{task_description}

## Available Source Files
{''.join(file_descriptions)}

## Output Requirements
- Write the output to: {self.derived_path / output_filename}
- Output format: CSV
- The code must be self-contained and executable

## Code Requirements
1. Use pandas for data manipulation
2. Handle potential data quality issues (missing values, type mismatches)
3. Use appropriate readers based on file extension (.xlsx/.xls use pd.read_excel, .csv use pd.read_csv)
4. Include error handling for file operations
5. Print a success message with row count when done

## Response Format
Respond with ONLY the Python code, wrapped in ```python ... ``` markers.
Do not include any explanation before or after the code.

```python
# Your code here
```"""

        try:
            response = self.client.messages.create(
                model=self.MODEL,
                max_tokens=4000,
                messages=[{"role": "user", "content": prompt}],
            )
            self.total_tokens += response.usage.input_tokens + response.usage.output_tokens

            content = response.content[0].text.strip()

            # Extract code from markdown
            code_match = re.search(r'```python\s*(.*?)\s*```', content, re.DOTALL)
            if code_match:
                return code_match.group(1)

            # If no markdown, assume the whole response is code
            if 'import' in content and 'pandas' in content:
                return content

            return None

        except Exception as e:
            console.print(f"  [red]✗[/red] Code generation error: {e}")
            return None

    def _fix_code(
        self,
        code: str,
        error: str,
        file_info: Dict[str, Dict[str, Any]],
        output_filename: str,
    ) -> Optional[str]:
        """Fix code based on execution error.

        Args:
            code: The code that failed
            error: The error message
            file_info: Information about source files
            output_filename: Desired output filename

        Returns:
            Fixed code or None
        """
        # Build file descriptions for context
        file_descriptions = []
        for filename, info in file_info.items():
            desc = f"- {filename}: columns = {info['columns']}"
            file_descriptions.append(desc)

        prompt = f"""The following Python code failed with an error. Fix it.

## Original Code
```python
{code}
```

## Error
```
{error}
```

## Available Files
{chr(10).join(file_descriptions)}

## Output Path
{self.derived_path / output_filename}

## Instructions
Fix the code to handle the error. Respond with ONLY the corrected Python code.

```python
# Fixed code here
```"""

        try:
            response = self.client.messages.create(
                model=self.MODEL,
                max_tokens=4000,
                messages=[{"role": "user", "content": prompt}],
            )
            self.total_tokens += response.usage.input_tokens + response.usage.output_tokens

            content = response.content[0].text.strip()

            code_match = re.search(r'```python\s*(.*?)\s*```', content, re.DOTALL)
            if code_match:
                return code_match.group(1)

            return None

        except Exception as e:
            console.print(f"  [red]✗[/red] Code fix error: {e}")
            return None

    def _execute_code(self, code: str, output_filename: str) -> Tuple[bool, str]:
        """Execute Python code safely.

        Args:
            code: Python code to execute
            output_filename: Expected output filename (for validation)

        Returns:
            Tuple of (success, error_message)
        """
        # Create a temporary file for the code
        with tempfile.NamedTemporaryFile(
            mode='w',
            suffix='.py',
            delete=False,
            dir=self.workspace,
        ) as f:
            f.write(code)
            script_path = f.name

        try:
            # Execute the code in a subprocess
            result = subprocess.run(
                [sys.executable, script_path],
                capture_output=True,
                text=True,
                timeout=self.TIMEOUT_SECONDS,
                cwd=str(self.workspace),
            )

            if result.returncode == 0:
                if result.stdout:
                    console.print(f"    {result.stdout.strip()}")
                return True, ""
            else:
                error = result.stderr or result.stdout or "Unknown error"
                return False, error

        except subprocess.TimeoutExpired:
            return False, f"Code execution timed out after {self.TIMEOUT_SECONDS} seconds"
        except Exception as e:
            return False, str(e)
        finally:
            # Clean up the temporary script
            try:
                os.unlink(script_path)
            except Exception:
                pass

    def _find_file(self, filename: str) -> Optional[Path]:
        """Find a file in the workspace.

        Args:
            filename: Filename to find

        Returns:
            Path to file or None
        """
        # Check cleaned first, then input
        for search_path in [self.cleaned_path, self.input_path]:
            file_path = search_path / filename
            if file_path.exists():
                return file_path

            # Try case-insensitive match
            if search_path.exists():
                for pattern in ["*.csv", "*.xlsx", "*.xls"]:
                    for f in search_path.glob(pattern):
                        if f.name.lower() == filename.lower():
                            return f

        return None


def execute_custom_data_task(
    workspace: Path,
    task_description: str,
    source_files: List[str],
    output_filename: str,
    file_samples: Optional[Dict[str, str]] = None,
) -> Optional[Path]:
    """Convenience function to execute a custom data engineering task.

    Args:
        workspace: Path to workspace
        task_description: What to create
        source_files: Source files to use
        output_filename: Desired output filename
        file_samples: Optional file samples

    Returns:
        Path to output file or None
    """
    agent = DataEngineerAgent(workspace)
    return agent.execute_task(
        task_description=task_description,
        source_files=source_files,
        output_filename=output_filename,
        file_samples=file_samples,
    )
