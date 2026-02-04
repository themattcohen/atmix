#!/usr/bin/env python3
"""atmix v3: Client Pricing Quote Generator.

Analyzes prospect financial data and generates bookkeeping service quotes
based on AllSolutions Consulting pricing tiers.

Usage:
    python run_pricing.py <workspace_path> [options]

Example:
    python run_pricing.py workspaces/prospect
    python run_pricing.py workspaces/prospect --output quote.md
"""

import json
import sys
from pathlib import Path

# Load .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import click
from rich.console import Console
from rich.panel import Panel

console = Console()


@click.command()
@click.argument("workspace", type=click.Path(exists=True))
@click.option(
    "--output",
    "-o",
    type=click.Path(),
    default=None,
    help="Output file for proposal (markdown)",
)
@click.option(
    "--company-name",
    "-n",
    type=str,
    default=None,
    help="Company name for the proposal",
)
@click.option(
    "--verbose",
    "-v",
    is_flag=True,
    default=False,
    help="Enable verbose output",
)
def main(workspace: str, output: str, company_name: str, verbose: bool):
    """Generate a bookkeeping service pricing quote.

    WORKSPACE is the path to the workspace directory containing the prospect's
    financial data in the 'input' or 'cleaned' subdirectory.

    The tool will:
    1. Analyze the financial data to understand complexity
    2. Determine appropriate pricing tier
    3. Generate a detailed quote
    4. Optionally create a proposal document

    Example:
        python run_pricing.py workspaces/prospect --company-name "Acme Corp"
    """
    workspace_path = Path(workspace).resolve()

    # Validate workspace structure
    if not (workspace_path / "input").exists() and not (workspace_path / "cleaned").exists():
        console.print("[red]Error: Workspace must have 'input' or 'cleaned' directory[/red]")
        sys.exit(1)

    # Check for API key
    import os
    if not os.environ.get("ANTHROPIC_API_KEY"):
        console.print("[red]Error: ANTHROPIC_API_KEY environment variable not set[/red]")
        sys.exit(1)

    console.print("\n")
    console.print(Panel(
        "[bold blue]atmix v3: Client Pricing Quote[/bold blue]\n\n"
        "Analyzing prospect data to generate pricing recommendation\n"
        "based on AllSolutions Consulting service tiers.",
        title="Pricing Quote Generator",
        border_style="blue"
    ))

    try:
        import anthropic
        from atmix.engine.file_processors import FileIngestionManager
        from atmix.engine.pricing import PricingEngine, ClientAnalysis

        # Initialize
        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        pricing_engine = PricingEngine(client)
        file_manager = FileIngestionManager(interactive=False)

        # Phase 1: Ingest data
        console.print("\n[bold]Phase 1: Data Ingestion[/bold]")

        data_files = {}
        data_samples = {}

        for search_path in [workspace_path / "cleaned", workspace_path / "input"]:
            if not search_path.exists():
                continue
            dir_files, dir_samples, _ = file_manager.process_directory(search_path)
            for filename, file_type in dir_files.items():
                if filename not in data_files:
                    data_files[filename] = file_type
            for filename, sample in dir_samples.items():
                if filename not in data_samples:
                    data_samples[filename] = sample

        if not data_files:
            console.print("[red]No data files found in workspace[/red]")
            sys.exit(1)

        console.print(f"  Found {len(data_files)} data files")

        # Phase 2: Gather context
        console.print("\n[bold]Phase 2: Context Gathering[/bold]")

        user_context = {}

        # Check for existing business_context.json
        context_file = workspace_path / "business_context.json"
        if context_file.exists():
            console.print(f"  [blue]Loading existing context from {context_file.name}[/blue]")
            with open(context_file) as f:
                saved_context = json.load(f)
            # Merge saved context into user_context
            user_context.update(saved_context)
            # Also include clarifications at top level for visibility
            if "clarifications" in saved_context:
                for key, value in saved_context["clarifications"].items():
                    user_context[f"clarification_{key}"] = value
            console.print(f"    Business type: {user_context.get('business_type', 'Unknown')}")
            console.print(f"    Has inventory: {user_context.get('has_inventory', 'Unknown')}")

        # Ask basic questions (allow override of loaded values)
        console.print("\nPlease answer a few questions about the prospect:\n")

        try:
            if not company_name:
                default_name = user_context.get("company_name", workspace_path.name)
                company_name = input(f"Company name [{default_name}]: ").strip() or default_name
            user_context["company_name"] = company_name

            default_type = user_context.get("business_type", "")
            business_type = input(f"Business type (e.g., e-commerce, service, retail) [{default_type}]: ").strip()
            user_context["business_type"] = business_type or default_type or "Unknown"

            current_accounting = input("Current accounting software (if any): ").strip()
            user_context["current_accounting"] = current_accounting or "Unknown"

            pain_points = input("Main pain points or needs: ").strip()
            user_context["pain_points"] = pain_points or "General bookkeeping"

        except EOFError:
            # Non-interactive mode - use loaded context or defaults
            user_context["company_name"] = company_name or user_context.get("company_name", workspace_path.name)
            user_context["business_type"] = user_context.get("business_type", "Unknown")
            user_context["current_accounting"] = "Unknown"
            user_context["pain_points"] = "General bookkeeping"

        console.print(f"\n  [green]✓[/green] Context collected for {user_context['company_name']}")

        # Phase 3: Analyze prospect
        console.print("\n[bold]Phase 3: Analyzing Prospect Data[/bold]")

        from rich.progress import Progress, SpinnerColumn, TextColumn

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Analyzing complexity and needs...", total=None)

            analysis = pricing_engine.analyze_prospect(
                data_files=data_files,
                data_samples=data_samples,
                user_context=user_context,
            )

            progress.remove_task(task)

        console.print(f"  [green]✓[/green] Analysis complete")
        console.print(f"    • Monthly transactions: ~{analysis.monthly_transactions}")
        console.print(f"    • Accounts: {analysis.bank_accounts} bank, {analysis.credit_cards} credit cards")
        console.print(f"    • Platforms: {', '.join(analysis.platforms) or 'None detected'}")
        console.print(f"    • Needs AR/AP: {'Yes' if analysis.needs_ar or analysis.needs_ap else 'No'}")
        if analysis.months_behind > 0:
            console.print(f"    • Catch-up needed: {analysis.months_behind} months")

        # Phase 4: Generate quote
        console.print("\n[bold]Phase 4: Generating Quote[/bold]")

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Generating pricing recommendation...", total=None)

            quote = pricing_engine.generate_quote(analysis, user_context)

            progress.remove_task(task)

        # Display quote
        quote_display = pricing_engine.format_quote_display(quote, analysis)
        console.print("\n" + quote_display)

        # Phase 5: Generate proposal (if requested)
        if output:
            console.print("\n[bold]Phase 5: Generating Proposal Document[/bold]")

            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console,
            ) as progress:
                task = progress.add_task("Writing proposal...", total=None)

                proposal = pricing_engine.generate_proposal_markdown(
                    quote, analysis, user_context["company_name"]
                )

                progress.remove_task(task)

            output_path = Path(output)
            with open(output_path, "w") as f:
                f.write(proposal)

            console.print(f"  [green]✓[/green] Proposal saved to: {output_path}")

        # Summary
        console.print("\n")
        console.print(Panel(
            f"[bold green]Quote Generated![/bold green]\n\n"
            f"Company: {user_context['company_name']}\n"
            f"Recommended Tier: {quote.recommended_tier}\n"
            f"Monthly Fee: ${quote.monthly_price:,}\n"
            f"{'Cleanup Fee: $' + str(quote.cleanup_fee) if quote.cleanup_fee else ''}\n",
            title="Summary",
            border_style="green"
        ))

    except KeyboardInterrupt:
        console.print("\n[yellow]Cancelled[/yellow]")
        sys.exit(130)

    except Exception as e:
        console.print(f"\n[red]Error: {e}[/red]")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
