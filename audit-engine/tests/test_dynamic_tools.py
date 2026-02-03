"""Tests for dynamic tool generation and execution."""

import json
import pytest
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from atmix.engine.dynamic_tools import (
    Tool,
    ToolExecutionResult,
    ToolLibrary,
    DynamicToolGenerator,
)


class TestTool:
    """Tests for the Tool dataclass."""

    def test_success_rate_no_uses(self):
        tool = Tool(
            name="test_tool",
            description="Test description",
            code="def run(x): return x",
            input_schema="any",
            output_schema="any",
            created_at="2024-01-01T00:00:00",
        )
        assert tool.success_rate == 0.0

    def test_success_rate_with_uses(self):
        tool = Tool(
            name="test_tool",
            description="Test description",
            code="def run(x): return x",
            input_schema="any",
            output_schema="any",
            created_at="2024-01-01T00:00:00",
            use_count=10,
            success_count=8,
        )
        assert tool.success_rate == 0.8

    def test_to_dict(self):
        tool = Tool(
            name="test_tool",
            description="Test description",
            code="def run(x): return x",
            input_schema="dict with 'value' key",
            output_schema="dict with 'result' key",
            created_at="2024-01-01T00:00:00",
            use_count=5,
            success_count=4,
        )
        d = tool.to_dict()
        assert d["name"] == "test_tool"
        assert d["description"] == "Test description"
        assert d["use_count"] == 5
        assert d["success_count"] == 4

    def test_from_dict(self):
        data = {
            "name": "test_tool",
            "description": "Test description",
            "code": "def run(x): return x",
            "input_schema": "any",
            "output_schema": "any",
            "created_at": "2024-01-01T00:00:00",
            "use_count": 3,
            "success_count": 2,
        }
        tool = Tool.from_dict(data)
        assert tool.name == "test_tool"
        assert tool.use_count == 3
        assert tool.success_count == 2


class TestToolExecutionResult:
    """Tests for the ToolExecutionResult dataclass."""

    def test_success_result(self):
        result = ToolExecutionResult(
            success=True,
            output={"result": 42},
            execution_time=0.5,
        )
        assert result.success
        assert result.output == {"result": 42}
        assert result.error is None

    def test_error_result(self):
        result = ToolExecutionResult(
            success=False,
            output=None,
            error="Division by zero",
            execution_time=0.1,
        )
        assert not result.success
        assert result.error == "Division by zero"

    def test_to_dict(self):
        result = ToolExecutionResult(
            success=True,
            output={"value": 100},
            execution_time=1.5,
        )
        d = result.to_dict()
        assert d["success"]
        assert d["output"] == {"value": 100}
        assert d["execution_time"] == 1.5


class TestToolLibrary:
    """Tests for the ToolLibrary class."""

    def test_empty_library(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            library = ToolLibrary(Path(tmpdir) / "tools")
            assert library.list_tools() == []
            assert library.get_tool("nonexistent") is None

    def test_save_and_get_tool(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tools_dir = Path(tmpdir) / "tools"
            library = ToolLibrary(tools_dir)

            tool = Tool(
                name="sum_numbers",
                description="Sum a list of numbers",
                code="def run(data): return {'sum': sum(data['numbers'])}",
                input_schema="dict with 'numbers' list",
                output_schema="dict with 'sum' key",
                created_at="2024-01-01T00:00:00",
            )
            library.save_tool(tool)

            # Verify tool is saved
            retrieved = library.get_tool("sum_numbers")
            assert retrieved is not None
            assert retrieved.name == "sum_numbers"
            assert retrieved.description == "Sum a list of numbers"

            # Verify code file exists
            assert (tools_dir / "sum_numbers.py").exists()

            # Verify registry file exists
            assert (tools_dir / "registry.json").exists()

    def test_persistence(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tools_dir = Path(tmpdir) / "tools"

            # Save with first library instance
            library1 = ToolLibrary(tools_dir)
            tool = Tool(
                name="test_persist",
                description="Test persistence",
                code="def run(x): return x",
                input_schema="any",
                output_schema="any",
                created_at="2024-01-01T00:00:00",
            )
            library1.save_tool(tool)

            # Load with new library instance
            library2 = ToolLibrary(tools_dir)
            retrieved = library2.get_tool("test_persist")
            assert retrieved is not None
            assert retrieved.name == "test_persist"

    def test_find_relevant_tools(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            library = ToolLibrary(Path(tmpdir) / "tools")

            # Save several tools
            tools = [
                Tool(
                    name="sum_numbers",
                    description="Sum a list of numbers",
                    code="",
                    input_schema="",
                    output_schema="",
                    created_at="",
                    success_count=8,
                    use_count=10,
                ),
                Tool(
                    name="parse_csv",
                    description="Parse CSV data into records",
                    code="",
                    input_schema="",
                    output_schema="",
                    created_at="",
                    success_count=5,
                    use_count=10,
                ),
                Tool(
                    name="filter_data",
                    description="Filter data by criteria",
                    code="",
                    input_schema="",
                    output_schema="",
                    created_at="",
                    success_count=9,
                    use_count=10,
                ),
            ]
            for tool in tools:
                library.save_tool(tool)

            # Find relevant tools
            relevant = library.find_relevant_tools("I need to sum some numbers")
            assert len(relevant) >= 1
            assert any(t.name == "sum_numbers" for t in relevant)

            # Find CSV-related tools
            csv_relevant = library.find_relevant_tools("parse this CSV file")
            assert any(t.name == "parse_csv" for t in csv_relevant)

    def test_record_usage(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            library = ToolLibrary(Path(tmpdir) / "tools")

            tool = Tool(
                name="test_usage",
                description="Test usage tracking",
                code="def run(x): return x",
                input_schema="any",
                output_schema="any",
                created_at="2024-01-01T00:00:00",
            )
            library.save_tool(tool)

            # Record successful uses
            library.record_usage("test_usage", success=True)
            library.record_usage("test_usage", success=True)
            library.record_usage("test_usage", success=False)

            updated = library.get_tool("test_usage")
            assert updated.use_count == 3
            assert updated.success_count == 2
            assert updated.last_used is not None

    def test_delete_tool(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tools_dir = Path(tmpdir) / "tools"
            library = ToolLibrary(tools_dir)

            tool = Tool(
                name="to_delete",
                description="Tool to delete",
                code="def run(x): return x",
                input_schema="any",
                output_schema="any",
                created_at="2024-01-01T00:00:00",
            )
            library.save_tool(tool)

            # Verify tool exists
            assert library.get_tool("to_delete") is not None
            assert (tools_dir / "to_delete.py").exists()

            # Delete tool
            result = library.delete_tool("to_delete")
            assert result
            assert library.get_tool("to_delete") is None
            assert not (tools_dir / "to_delete.py").exists()

            # Deleting non-existent tool returns False
            assert not library.delete_tool("nonexistent")


class TestDynamicToolGenerator:
    """Tests for the DynamicToolGenerator class."""

    def test_execute_code_success(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            generator = DynamicToolGenerator(
                llm_client=MagicMock(),
                tools_dir=Path(tmpdir) / "tools",
            )

            code = """
def run(input_data):
    numbers = input_data.get('numbers', [])
    return {'sum': sum(numbers), 'count': len(numbers)}
"""
            result = generator.execute_code(code, {"numbers": [1, 2, 3, 4, 5]})

            assert result.success
            assert result.output["sum"] == 15
            assert result.output["count"] == 5
            assert result.execution_time > 0

    def test_execute_code_error(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            generator = DynamicToolGenerator(
                llm_client=MagicMock(),
                tools_dir=Path(tmpdir) / "tools",
            )

            code = """
def run(input_data):
    return input_data['missing_key']  # KeyError
"""
            result = generator.execute_code(code, {"other_key": "value"})

            assert not result.success
            assert result.error is not None
            assert "KeyError" in result.error

    def test_execute_code_timeout(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            generator = DynamicToolGenerator(
                llm_client=MagicMock(),
                tools_dir=Path(tmpdir) / "tools",
            )

            code = """
import time
def run(input_data):
    time.sleep(10)
    return {'done': True}
"""
            result = generator.execute_code(code, {}, timeout=1)

            assert not result.success
            assert "timed out" in result.error.lower()

    def test_execute_code_non_json_output(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            generator = DynamicToolGenerator(
                llm_client=MagicMock(),
                tools_dir=Path(tmpdir) / "tools",
            )

            # Code that prints non-JSON
            code = """
def run(input_data):
    return "plain string not JSON serializable as-is"
"""
            result = generator.execute_code(code, {})
            # Should still succeed but capture raw output
            assert result.success

    def test_generate_tool_code(self):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="""
def run(input_data):
    \"\"\"Calculate the average of numbers.\"\"\"
    numbers = input_data.get('numbers', [])
    if not numbers:
        return {'average': 0, 'error': None}
    return {'average': sum(numbers) / len(numbers), 'error': None}
""")]
        mock_client.messages.create.return_value = mock_response

        generator = DynamicToolGenerator(llm_client=mock_client)

        code = generator.generate_tool_code(
            task="Calculate the average of a list of numbers",
            input_description="dict with 'numbers' key containing list of floats",
            output_description="dict with 'average' key containing the result",
        )

        assert "def run(input_data)" in code
        assert "average" in code
        mock_client.messages.create.assert_called_once()

    def test_generate_tool_code_strips_markdown(self):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="""```python
def run(input_data):
    return {'result': input_data['value'] * 2}
```""")]
        mock_client.messages.create.return_value = mock_response

        generator = DynamicToolGenerator(llm_client=mock_client)

        code = generator.generate_tool_code(
            task="Double a number",
            input_description="dict with 'value' key",
            output_description="dict with 'result' key",
        )

        assert not code.startswith("```")
        assert not code.endswith("```")
        assert "def run" in code

    def test_use_existing_tool_no_library(self):
        generator = DynamicToolGenerator(llm_client=MagicMock())

        result = generator.use_existing_tool("any_tool", {})

        assert not result.success
        assert "No tool library configured" in result.error

    def test_use_existing_tool_not_found(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            generator = DynamicToolGenerator(
                llm_client=MagicMock(),
                tools_dir=Path(tmpdir) / "tools",
            )

            result = generator.use_existing_tool("nonexistent", {})

            assert not result.success
            assert "not found" in result.error

    def test_use_existing_tool_success(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            generator = DynamicToolGenerator(
                llm_client=MagicMock(),
                tools_dir=Path(tmpdir) / "tools",
            )

            # Save a tool first
            tool = Tool(
                name="multiply",
                description="Multiply two numbers",
                code="""
def run(input_data):
    a = input_data['a']
    b = input_data['b']
    return {'product': a * b}
""",
                input_schema="dict with 'a' and 'b' keys",
                output_schema="dict with 'product' key",
                created_at="2024-01-01T00:00:00",
            )
            generator.library.save_tool(tool)

            # Use the tool
            result = generator.use_existing_tool("multiply", {"a": 7, "b": 6})

            assert result.success
            assert result.output["product"] == 42

            # Verify usage was recorded
            updated = generator.library.get_tool("multiply")
            assert updated.use_count == 1
            assert updated.success_count == 1

    def test_generate_and_execute(self):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="""
def run(input_data):
    text = input_data['text']
    return {'length': len(text), 'upper': text.upper()}
""")]
        mock_client.messages.create.return_value = mock_response

        with tempfile.TemporaryDirectory() as tmpdir:
            generator = DynamicToolGenerator(
                llm_client=mock_client,
                tools_dir=Path(tmpdir) / "tools",
            )

            result = generator.generate_and_execute(
                task="Get length and uppercase of text",
                input_description="dict with 'text' key",
                output_description="dict with 'length' and 'upper' keys",
                input_data={"text": "hello world"},
            )

            assert result.success
            assert result.output["length"] == 11
            assert result.output["upper"] == "HELLO WORLD"

    def test_generate_and_execute_save_successful(self):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="""
def run(input_data):
    return {'reversed': input_data['text'][::-1]}
""")]
        mock_client.messages.create.return_value = mock_response

        with tempfile.TemporaryDirectory() as tmpdir:
            generator = DynamicToolGenerator(
                llm_client=mock_client,
                tools_dir=Path(tmpdir) / "tools",
            )

            result = generator.generate_and_execute(
                task="Reverse text",
                input_description="dict with 'text' key",
                output_description="dict with 'reversed' key",
                input_data={"text": "hello"},
                save_if_successful=True,
                tool_name="reverse_text",
            )

            assert result.success
            assert result.output["reversed"] == "olleh"

            # Verify tool was saved
            saved = generator.library.get_tool("reverse_text")
            assert saved is not None
            assert saved.name == "reverse_text"

    def test_list_available_tools_empty(self):
        generator = DynamicToolGenerator(llm_client=MagicMock())
        result = generator.list_available_tools()
        assert "No tool library configured" in result

    def test_list_available_tools_with_library(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            generator = DynamicToolGenerator(
                llm_client=MagicMock(),
                tools_dir=Path(tmpdir) / "tools",
            )

            # Empty library
            assert "empty" in generator.list_available_tools()

            # Add a tool
            tool = Tool(
                name="test_tool",
                description="A test tool",
                code="def run(x): return x",
                input_schema="any input",
                output_schema="same output",
                created_at="2024-01-01T00:00:00",
                use_count=5,
                success_count=4,
            )
            generator.library.save_tool(tool)

            result = generator.list_available_tools()
            assert "test_tool" in result
            assert "A test tool" in result
            assert "80%" in result  # Success rate

    def test_suggest_tool_for_task(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            generator = DynamicToolGenerator(
                llm_client=MagicMock(),
                tools_dir=Path(tmpdir) / "tools",
            )

            # No tools - no suggestion
            assert generator.suggest_tool_for_task("calculate sum") is None

            # Add relevant tool
            tool = Tool(
                name="calculate_sum",
                description="Calculate sum of numbers",
                code="def run(x): return {'sum': sum(x['nums'])}",
                input_schema="dict with 'nums' list",
                output_schema="dict with 'sum'",
                created_at="2024-01-01T00:00:00",
                use_count=10,
                success_count=9,
            )
            generator.library.save_tool(tool)

            suggested = generator.suggest_tool_for_task("I need to calculate a sum")
            assert suggested is not None
            assert suggested.name == "calculate_sum"


class TestIntegration:
    """Integration tests for the complete workflow."""

    def test_full_workflow_generate_save_reuse(self):
        """Test generating a tool, saving it, and reusing it."""
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="""
def run(input_data):
    numbers = input_data['numbers']
    total = sum(numbers)
    average = total / len(numbers) if numbers else 0
    return {
        'sum': total,
        'average': average,
        'count': len(numbers)
    }
""")]
        mock_client.messages.create.return_value = mock_response

        with tempfile.TemporaryDirectory() as tmpdir:
            tools_dir = Path(tmpdir) / "tools"
            generator = DynamicToolGenerator(
                llm_client=mock_client,
                tools_dir=tools_dir,
            )

            # Generate and execute, saving the tool
            result1 = generator.generate_and_execute(
                task="Calculate statistics for a list of numbers",
                input_description="dict with 'numbers' list",
                output_description="dict with 'sum', 'average', 'count'",
                input_data={"numbers": [10, 20, 30, 40, 50]},
                save_if_successful=True,
                tool_name="number_stats",
            )

            assert result1.success
            assert result1.output["sum"] == 150
            assert result1.output["average"] == 30

            # Reuse the saved tool (no LLM call needed)
            result2 = generator.use_existing_tool(
                "number_stats",
                {"numbers": [1, 2, 3, 4, 5]},
            )

            assert result2.success
            assert result2.output["sum"] == 15
            assert result2.output["average"] == 3

            # Verify LLM was only called once (for generation)
            assert mock_client.messages.create.call_count == 1

            # Verify tool stats
            tool = generator.library.get_tool("number_stats")
            assert tool.use_count == 1  # Only the reuse counts
            assert tool.success_count == 1
