"""Dynamic tool generation and execution for ATMIX v3.

The LLM can generate Python tools on-demand and optionally save them
for future reuse. Tools are always optional - the LLM decides whether
to use existing tools, modify them, or write new ones.
"""

import json
import subprocess
import tempfile
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class Tool:
    """A saved tool in the library."""

    name: str
    description: str
    code: str
    input_schema: str
    output_schema: str
    created_at: str
    last_used: Optional[str] = None
    use_count: int = 0
    success_count: int = 0

    @property
    def success_rate(self) -> float:
        """Calculate the success rate of tool executions."""
        if self.use_count == 0:
            return 0.0
        return self.success_count / self.use_count

    def to_dict(self) -> Dict[str, Any]:
        """Convert tool to dictionary for serialization."""
        return {
            "name": self.name,
            "description": self.description,
            "code": self.code,
            "input_schema": self.input_schema,
            "output_schema": self.output_schema,
            "created_at": self.created_at,
            "last_used": self.last_used,
            "use_count": self.use_count,
            "success_count": self.success_count,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Tool":
        """Create a Tool from a dictionary."""
        return cls(
            name=data["name"],
            description=data["description"],
            code=data["code"],
            input_schema=data["input_schema"],
            output_schema=data["output_schema"],
            created_at=data["created_at"],
            last_used=data.get("last_used"),
            use_count=data.get("use_count", 0),
            success_count=data.get("success_count", 0),
        )


@dataclass
class ToolExecutionResult:
    """Result of executing a tool."""

    success: bool
    output: Any
    error: Optional[str] = None
    execution_time: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary."""
        return {
            "success": self.success,
            "output": self.output,
            "error": self.error,
            "execution_time": self.execution_time,
        }


class ToolLibrary:
    """Registry of saved tools for optional reuse."""

    def __init__(self, tools_dir: Path):
        """Initialize the tool library.

        Args:
            tools_dir: Directory to store tool registry and code files.
        """
        self.tools_dir = Path(tools_dir)
        self.registry_path = self.tools_dir / "registry.json"
        self._tools: Dict[str, Tool] = {}
        self._load_registry()

    def _load_registry(self) -> None:
        """Load tool registry from disk."""
        if self.registry_path.exists():
            try:
                with open(self.registry_path, encoding="utf-8") as f:
                    data = json.load(f)
                    for tool_data in data.get("tools", []):
                        tool = Tool.from_dict(tool_data)
                        self._tools[tool.name] = tool
            except (json.JSONDecodeError, KeyError) as e:
                # Log error but don't fail - start with empty registry
                print(f"Warning: Could not load tool registry: {e}")
                self._tools = {}

    def _save_registry(self) -> None:
        """Save tool registry to disk."""
        self.tools_dir.mkdir(parents=True, exist_ok=True)
        data = {"tools": [t.to_dict() for t in self._tools.values()]}
        with open(self.registry_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def list_tools(self) -> List[Tool]:
        """List all available tools.

        Returns:
            List of all tools in the library.
        """
        return list(self._tools.values())

    def get_tool(self, name: str) -> Optional[Tool]:
        """Get a specific tool by name.

        Args:
            name: Name of the tool to retrieve.

        Returns:
            The tool if found, None otherwise.
        """
        return self._tools.get(name)

    def find_relevant_tools(self, task_description: str) -> List[Tool]:
        """Find tools that might be relevant for a task.

        Args:
            task_description: Description of the task to match against.

        Returns:
            List of tools that might be relevant (LLM makes final decision).
        """
        relevant = []
        task_lower = task_description.lower()
        task_words = set(task_lower.split())

        for tool in self._tools.values():
            # Match on tool name
            if tool.name.lower() in task_lower:
                relevant.append(tool)
                continue

            # Match on description keywords
            desc_words = set(tool.description.lower().split())
            if task_words & desc_words:  # Any overlap
                relevant.append(tool)

        # Sort by success rate (most reliable first)
        relevant.sort(key=lambda t: t.success_rate, reverse=True)
        return relevant

    def save_tool(self, tool: Tool) -> None:
        """Save a new tool to the library.

        Args:
            tool: Tool to save.
        """
        self._tools[tool.name] = tool

        # Save code to file for inspection/debugging
        self.tools_dir.mkdir(parents=True, exist_ok=True)
        tool_path = self.tools_dir / f"{tool.name}.py"
        with open(tool_path, "w", encoding="utf-8") as f:
            f.write(tool.code)

        self._save_registry()

    def delete_tool(self, name: str) -> bool:
        """Delete a tool from the library.

        Args:
            name: Name of the tool to delete.

        Returns:
            True if deleted, False if not found.
        """
        if name not in self._tools:
            return False

        del self._tools[name]

        # Remove code file if exists
        tool_path = self.tools_dir / f"{name}.py"
        if tool_path.exists():
            tool_path.unlink()

        self._save_registry()
        return True

    def record_usage(self, name: str, success: bool) -> None:
        """Record that a tool was used.

        Args:
            name: Name of the tool that was used.
            success: Whether the execution was successful.
        """
        if name in self._tools:
            tool = self._tools[name]
            tool.use_count += 1
            if success:
                tool.success_count += 1
            tool.last_used = datetime.now().isoformat()
            self._save_registry()


class DynamicToolGenerator:
    """Generate and execute Python tools on-demand."""

    # Default timeout for tool execution (seconds)
    DEFAULT_TIMEOUT = 60

    # Model to use for code generation
    DEFAULT_MODEL = "claude-sonnet-4-20250514"

    def __init__(
        self,
        llm_client: Any,
        tools_dir: Optional[Path] = None,
        model: Optional[str] = None,
    ):
        """Initialize the dynamic tool generator.

        Args:
            llm_client: Anthropic client for LLM calls.
            tools_dir: Optional directory for tool library persistence.
            model: Optional model override for code generation.
        """
        self.llm_client = llm_client
        self.library = ToolLibrary(tools_dir) if tools_dir else None
        self.model = model or self.DEFAULT_MODEL

    def generate_tool_code(
        self,
        task: str,
        input_description: str,
        output_description: str,
        context: Optional[str] = None,
    ) -> str:
        """Have LLM generate Python code for a task.

        Args:
            task: Description of what the tool should do.
            input_description: Description of expected input format.
            output_description: Description of expected output format.
            context: Optional additional context for code generation.

        Returns:
            Generated Python code as a string.
        """
        prompt = f"""Write a Python function to accomplish this task.

TASK: {task}

INPUT: {input_description}

EXPECTED OUTPUT: {output_description}

{f"CONTEXT: {context}" if context else ""}

Requirements:
- Create a function called `run(input_data)` that takes the input and returns the output
- Function should be self-contained (import dependencies inside if needed)
- Handle edge cases gracefully with try/except
- Return a dict with the results
- Include a docstring explaining what it does
- Use only standard library + pandas + json

Return ONLY the Python code. No explanation, no markdown code blocks.
"""

        response = self.llm_client.messages.create(
            model=self.model,
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
        )

        code = response.content[0].text.strip()

        # Remove markdown code blocks if present
        if code.startswith("```python"):
            code = code[9:]
        if code.startswith("```"):
            code = code[3:]
        if code.endswith("```"):
            code = code[:-3]

        return code.strip()

    def execute_code(
        self,
        code: str,
        input_data: Any,
        timeout: int = DEFAULT_TIMEOUT,
    ) -> ToolExecutionResult:
        """Execute Python code with input data.

        Args:
            code: Python code to execute.
            input_data: Input data to pass to the code.
            timeout: Maximum execution time in seconds.

        Returns:
            ToolExecutionResult with success status, output, and timing.
        """
        start_time = time.time()

        # Create temp directory for execution
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            # Write the tool code
            tool_file = tmpdir_path / "tool.py"
            with open(tool_file, "w", encoding="utf-8") as f:
                f.write(code)

            # Write input data as JSON
            input_file = tmpdir_path / "input.json"
            with open(input_file, "w", encoding="utf-8") as f:
                json.dump(input_data, f)

            # Write runner script
            runner_file = tmpdir_path / "runner.py"
            runner_code = """
import json
import sys
sys.path.insert(0, ".")
from tool import run

with open("input.json") as f:
    input_data = json.load(f)

result = run(input_data)
print(json.dumps(result))
"""
            with open(runner_file, "w", encoding="utf-8") as f:
                f.write(runner_code)

            # Execute
            try:
                result = subprocess.run(
                    ["python3", "runner.py"],
                    cwd=tmpdir_path,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                )

                execution_time = time.time() - start_time

                if result.returncode == 0:
                    try:
                        output = json.loads(result.stdout)
                        return ToolExecutionResult(
                            success=True,
                            output=output,
                            execution_time=execution_time,
                        )
                    except json.JSONDecodeError:
                        # Output wasn't JSON - return raw stdout
                        return ToolExecutionResult(
                            success=True,
                            output=result.stdout.strip(),
                            execution_time=execution_time,
                        )
                else:
                    return ToolExecutionResult(
                        success=False,
                        output=None,
                        error=result.stderr.strip() or "Unknown error",
                        execution_time=execution_time,
                    )

            except subprocess.TimeoutExpired:
                return ToolExecutionResult(
                    success=False,
                    output=None,
                    error=f"Execution timed out after {timeout} seconds",
                    execution_time=timeout,
                )
            except FileNotFoundError:
                return ToolExecutionResult(
                    success=False,
                    output=None,
                    error="Python3 interpreter not found",
                    execution_time=time.time() - start_time,
                )
            except Exception as e:
                return ToolExecutionResult(
                    success=False,
                    output=None,
                    error=str(e),
                    execution_time=time.time() - start_time,
                )

    def generate_and_execute(
        self,
        task: str,
        input_description: str,
        output_description: str,
        input_data: Any,
        context: Optional[str] = None,
        save_if_successful: bool = False,
        tool_name: Optional[str] = None,
        timeout: int = DEFAULT_TIMEOUT,
    ) -> ToolExecutionResult:
        """Generate a tool and execute it in one step.

        Args:
            task: Description of what the tool should do.
            input_description: Description of expected input format.
            output_description: Description of expected output format.
            input_data: Actual input data to process.
            context: Optional additional context for code generation.
            save_if_successful: Whether to save the tool to library if successful.
            tool_name: Name for the tool if saving.
            timeout: Maximum execution time in seconds.

        Returns:
            ToolExecutionResult with success status, output, and timing.
        """
        code = self.generate_tool_code(task, input_description, output_description, context)
        result = self.execute_code(code, input_data, timeout)

        # Optionally save successful tools
        if save_if_successful and result.success and self.library and tool_name:
            tool = Tool(
                name=tool_name,
                description=task,
                code=code,
                input_schema=input_description,
                output_schema=output_description,
                created_at=datetime.now().isoformat(),
            )
            self.library.save_tool(tool)

        return result

    def use_existing_tool(
        self,
        tool_name: str,
        input_data: Any,
        timeout: int = DEFAULT_TIMEOUT,
    ) -> ToolExecutionResult:
        """Use a tool from the library.

        Args:
            tool_name: Name of the tool to use.
            input_data: Input data to pass to the tool.
            timeout: Maximum execution time in seconds.

        Returns:
            ToolExecutionResult with success status, output, and timing.
        """
        if not self.library:
            return ToolExecutionResult(
                success=False,
                output=None,
                error="No tool library configured",
            )

        tool = self.library.get_tool(tool_name)
        if not tool:
            return ToolExecutionResult(
                success=False,
                output=None,
                error=f"Tool '{tool_name}' not found in library",
            )

        result = self.execute_code(tool.code, input_data, timeout)
        self.library.record_usage(tool_name, result.success)

        return result

    def list_available_tools(self) -> str:
        """Get a description of available tools for LLM context.

        Returns:
            Formatted string describing available tools.
        """
        if not self.library:
            return "No tool library configured."

        tools = self.library.list_tools()
        if not tools:
            return "Tool library is empty."

        lines = ["Available tools:"]
        for tool in tools:
            lines.append(f"\n- {tool.name}: {tool.description}")
            lines.append(f"  Input: {tool.input_schema}")
            lines.append(f"  Output: {tool.output_schema}")
            lines.append(f"  Success rate: {tool.success_rate:.0%} ({tool.use_count} uses)")

        return "\n".join(lines)

    def suggest_tool_for_task(self, task_description: str) -> Optional[Tool]:
        """Suggest a tool from the library for a task.

        Args:
            task_description: Description of the task.

        Returns:
            Most relevant tool if found, None otherwise.
        """
        if not self.library:
            return None

        relevant = self.library.find_relevant_tools(task_description)
        if relevant:
            return relevant[0]  # Return best match
        return None
