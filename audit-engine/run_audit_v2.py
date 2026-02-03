#!/usr/bin/env python3
"""ATMIX v2: LLM-First Financial Audit System.

This is the new CLI entry point for the LLM-first audit workflow.

Usage:
    python run_audit_v2.py <workspace_path> [options]

Example:
    python run_audit_v2.py workspaces/outdoor-playground
    python run_audit_v2.py workspaces/my-company --non-interactive

The LLM-first approach differs from v1:
- LLM plans what analyses are needed (not pre-defined scripts)
- LLM performs the actual analysis (not regex/rules)
- Python handles only data I/O and orchestration
- Hard guardrails prevent garbage output via user approval gates
"""

import sys
from pathlib import Path

# Load .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed, rely on environment variables

import click
from rich.console import Console

console = Console()


@click.command()
@click.argument("workspace", type=click.Path(exists=True))
@click.option(
    "--non-interactive",
    is_flag=True,
    default=False,
    help="Run without user approval gates (for testing only)",
)
@click.option(
    "--context-file",
    type=click.Path(exists=True),
    default=None,
    help="JSON file with pre-defined business context answers",
)
@click.option(
    "--resume",
    is_flag=True,
    default=False,
    help="Resume from last checkpoint if available",
)
@click.option(
    "--verbose",
    "-v",
    is_flag=True,
    default=False,
    help="Enable verbose output",
)
def main(workspace: str, non_interactive: bool, context_file: str, resume: bool, verbose: bool):
    """Run ATMIX v2 LLM-First Financial Audit.

    WORKSPACE is the path to the workspace directory containing financial data
    in the 'input' or 'cleaned' subdirectory.

    The audit will:
    1. Analyze your data with LLM intelligence
    2. Ask for your approval at 3 gates
    3. Generate executive-quality reports

    Example:
        python run_audit_v2.py workspaces/outdoor-playground
    """
    workspace_path = Path(workspace).resolve()

    # Validate workspace structure
    if not (workspace_path / "input").exists() and not (workspace_path / "cleaned").exists():
        console.print(f"[red]Error: Workspace must have 'input' or 'cleaned' directory[/red]")
        console.print(f"[dim]Path: {workspace_path}[/dim]")
        sys.exit(1)

    # Check for API key
    import os
    if not os.environ.get("ANTHROPIC_API_KEY"):
        console.print("[red]Error: ANTHROPIC_API_KEY environment variable not set[/red]")
        console.print("[dim]Set it with: export ANTHROPIC_API_KEY=your-key-here[/dim]")
        sys.exit(1)

    if non_interactive:
        console.print("[yellow]Warning: Running in non-interactive mode - auto-approving all gates[/yellow]")

    # Import and run orchestrator
    try:
        from atmix.engine.llm_orchestrator import LLMOrchestrator
        from atmix.prompts.context_gathering import BusinessContext
        import json

        # Load pre-defined context if provided
        predefined_context = None
        if context_file:
            with open(context_file) as f:
                ctx_data = json.load(f)
            predefined_context = BusinessContext(
                business_type=ctx_data.get("business_type", ""),
                primary_sales_system=ctx_data.get("primary_sales_system", ""),
                payment_processors=ctx_data.get("payment_processors", []),
                has_inventory=ctx_data.get("has_inventory", False),
                has_recurring_revenue=ctx_data.get("has_recurring_revenue", False),
                clarifications=ctx_data.get("clarifications", {}),
            )
            console.print(f"[blue]Loaded business context from: {context_file}[/blue]")

        orchestrator = LLMOrchestrator(
            workspace=workspace_path,
            interactive=not non_interactive,
            predefined_context=predefined_context,
        )

        success = orchestrator.run()

        if not success:
            console.print("\n[yellow]Audit did not complete successfully[/yellow]")
            sys.exit(1)

    except KeyboardInterrupt:
        console.print("\n[yellow]Audit interrupted[/yellow]")
        sys.exit(130)

    except Exception as e:
        console.print(f"\n[red]Fatal error: {e}[/red]")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
