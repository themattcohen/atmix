"""User approval gates for the LLM-first audit workflow.

These gates are HARD requirements - the system CANNOT proceed without explicit user approval.
"""

import json
import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .investigation.models import InvestigationCandidate

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Confirm, Prompt
from rich.table import Table
from rich.markdown import Markdown

console = Console()


def _is_interactive_tty() -> bool:
    """Check if stdin is an interactive terminal.

    Returns:
        True if stdin is a TTY, False if piped/redirected.
    """
    return sys.stdin.isatty()


def _simple_prompt(message: str, choices: List[str] = None, default: str = None) -> str:
    """Simple input() fallback for non-TTY environments.

    Args:
        message: Prompt message
        choices: Valid choices (optional)
        default: Default value (optional)

    Returns:
        User input string
    """
    prompt_text = message
    if choices:
        prompt_text += f" [{'/'.join(choices)}]"
    if default:
        prompt_text += f" ({default})"
    prompt_text += ": "

    console.print(prompt_text, end="")
    try:
        response = input().strip()
        if not response and default:
            return default
        if choices and response not in choices:
            console.print(f"[yellow]Invalid choice. Using default: {default}[/yellow]")
            return default or choices[0]
        return response
    except EOFError:
        console.print(f"[yellow]EOF received. Using default: {default}[/yellow]")
        return default or (choices[0] if choices else "")


def _simple_confirm(message: str, default: bool = True) -> bool:
    """Simple yes/no confirmation for non-TTY environments.

    Args:
        message: Prompt message
        default: Default value

    Returns:
        True for yes, False for no
    """
    default_str = "Y/n" if default else "y/N"
    console.print(f"{message} [{default_str}]: ", end="")
    try:
        response = input().strip().lower()
        if not response:
            return default
        return response in ("y", "yes", "1", "true")
    except EOFError:
        console.print(f"[yellow]EOF received. Using default: {default}[/yellow]")
        return default


class GateDecision(Enum):
    """User decisions at approval gates."""

    APPROVE = "approve"
    MODIFY = "modify"
    REJECT = "reject"
    ADD = "add"


@dataclass
class GateResult:
    """Result from a user gate."""

    decision: GateDecision
    approved: bool
    modifications: Optional[Dict[str, Any]] = None
    additions: Optional[List[str]] = None
    feedback: Optional[str] = None


class ApprovalGates:
    """Manages user approval gates for the audit workflow."""

    def __init__(self, interactive: bool = True):
        """Initialize approval gates.

        Args:
            interactive: If True, prompts user. If False, auto-approves (for testing).
        """
        self.interactive = interactive

    def gate_approve_plan(
        self,
        plan_display: str,
        plan_data: Dict[str, Any],
    ) -> GateResult:
        """Gate 1: User approves analysis plan.

        Args:
            plan_display: Formatted plan for display
            plan_data: Raw plan data for modifications

        Returns:
            GateResult with user's decision
        """
        console.print("\n")
        console.print(Panel(
            "[bold blue]GATE 1: ANALYSIS PLAN APPROVAL[/bold blue]\n\n"
            "Review the proposed analysis plan below.\n"
            "The system CANNOT proceed without your approval.",
            title="🚧 Approval Required",
            border_style="blue"
        ))

        console.print("\n")
        console.print(plan_display)

        if not self.interactive:
            console.print("[dim]Auto-approving in non-interactive mode[/dim]")
            return GateResult(decision=GateDecision.APPROVE, approved=True)

        # Prompt for decision
        console.print("\n[bold]Options:[/bold]")
        console.print("  [green]1[/green] - Approve this plan")
        console.print("  [yellow]2[/yellow] - Modify the plan")
        console.print("  [cyan]3[/cyan] - Add additional analyses")
        console.print("  [red]4[/red] - Cancel/Reject")

        # Use TTY-aware prompting
        if _is_interactive_tty():
            choice = Prompt.ask(
                "\n[bold]Your choice[/bold]",
                choices=["1", "2", "3", "4"],
                default="1"
            )
        else:
            choice = _simple_prompt("\nYour choice", ["1", "2", "3", "4"], "1")

        if choice == "1":
            console.print("[green]✓ Plan approved[/green]")
            return GateResult(decision=GateDecision.APPROVE, approved=True)

        elif choice == "2":
            if _is_interactive_tty():
                feedback = Prompt.ask(
                    "[yellow]What modifications do you want?[/yellow]\n"
                    "(Describe the changes needed)"
                )
            else:
                feedback = _simple_prompt("What modifications do you want?")
            return GateResult(
                decision=GateDecision.MODIFY,
                approved=False,
                feedback=feedback,
            )

        elif choice == "3":
            additions = []
            console.print("[cyan]Enter additional analyses (one per line, empty line when done):[/cyan]")
            while True:
                if _is_interactive_tty():
                    addition = Prompt.ask("  Add", default="")
                else:
                    addition = _simple_prompt("  Add", default="")
                if not addition:
                    break
                additions.append(addition)

            if additions:
                return GateResult(
                    decision=GateDecision.ADD,
                    approved=False,
                    additions=additions,
                )
            else:
                return GateResult(decision=GateDecision.APPROVE, approved=True)

        else:
            console.print("[red]✗ Plan rejected[/red]")
            return GateResult(decision=GateDecision.REJECT, approved=False)

    def gate_approve_findings(
        self,
        findings_display: str,
        findings_data: List[Dict[str, Any]],
        validation_results: Dict[str, Any],
    ) -> GateResult:
        """Gate 2: User approves analysis findings.

        Args:
            findings_display: Formatted findings for display
            findings_data: Raw findings data
            validation_results: Results from automated validation

        Returns:
            GateResult with user's decision
        """
        console.print("\n")
        console.print(Panel(
            "[bold blue]GATE 2: FINDINGS APPROVAL[/bold blue]\n\n"
            "Review the analysis findings below.\n"
            "The system CANNOT proceed to synthesis without your approval.",
            title="🚧 Approval Required",
            border_style="blue"
        ))

        # Show validation summary
        self._display_validation_summary(validation_results)

        console.print("\n")
        console.print(findings_display)

        if not self.interactive:
            console.print("[dim]Auto-approving in non-interactive mode[/dim]")
            return GateResult(decision=GateDecision.APPROVE, approved=True)

        # Show counts
        console.print(f"\n[bold]Total Findings: {len(findings_data)}[/bold]")

        severity_counts = {}
        for f in findings_data:
            sev = f.get("severity", "unknown")
            severity_counts[sev] = severity_counts.get(sev, 0) + 1

        console.print(f"  Critical: {severity_counts.get('critical', 0)}")
        console.print(f"  High: {severity_counts.get('high', 0)}")
        console.print(f"  Medium: {severity_counts.get('medium', 0)}")
        console.print(f"  Low/Info: {severity_counts.get('low', 0) + severity_counts.get('info', 0)}")

        # Prompt for decision
        console.print("\n[bold]Options:[/bold]")
        console.print("  [green]1[/green] - Approve findings and proceed to synthesis")
        console.print("  [yellow]2[/yellow] - Request re-analysis of specific areas")
        console.print("  [cyan]3[/cyan] - Add manual findings")
        console.print("  [red]4[/red] - Cancel/Reject")

        # Use TTY-aware prompting
        if _is_interactive_tty():
            choice = Prompt.ask(
                "\n[bold]Your choice[/bold]",
                choices=["1", "2", "3", "4"],
                default="1"
            )
        else:
            choice = _simple_prompt("\nYour choice", ["1", "2", "3", "4"], "1")

        if choice == "1":
            console.print("[green]✓ Findings approved[/green]")
            return GateResult(decision=GateDecision.APPROVE, approved=True)

        elif choice == "2":
            if _is_interactive_tty():
                feedback = Prompt.ask(
                    "[yellow]What areas need re-analysis?[/yellow]\n"
                    "(Describe what needs to be reanalyzed)"
                )
            else:
                feedback = _simple_prompt("What areas need re-analysis?")
            return GateResult(
                decision=GateDecision.MODIFY,
                approved=False,
                feedback=feedback,
            )

        elif choice == "3":
            console.print("[cyan]Adding manual findings is not yet implemented.[/cyan]")
            console.print("[cyan]Please describe your findings as feedback for now.[/cyan]")
            if _is_interactive_tty():
                feedback = Prompt.ask("Your findings")
            else:
                feedback = _simple_prompt("Your findings")
            return GateResult(
                decision=GateDecision.ADD,
                approved=False,
                feedback=feedback,
            )

        else:
            console.print("[red]✗ Findings rejected[/red]")
            return GateResult(decision=GateDecision.REJECT, approved=False)

    def gate_approve_draft(
        self,
        synthesis_display: str,
        synthesis_data: Dict[str, Any],
    ) -> GateResult:
        """Gate 3: User approves draft report.

        Args:
            synthesis_display: Formatted synthesis for display
            synthesis_data: Raw synthesis data

        Returns:
            GateResult with user's decision
        """
        console.print("\n")
        console.print(Panel(
            "[bold blue]GATE 3: DRAFT REPORT APPROVAL[/bold blue]\n\n"
            "Review the synthesized report draft below.\n"
            "The system CANNOT generate final reports without your approval.",
            title="🚧 Approval Required",
            border_style="blue"
        ))

        console.print("\n")
        console.print(synthesis_display)

        if not self.interactive:
            console.print("[dim]Auto-approving in non-interactive mode[/dim]")
            return GateResult(decision=GateDecision.APPROVE, approved=True)

        # Show summary
        console.print(f"\n[bold]Draft Summary:[/bold]")
        console.print(f"  Executive Summary: {len(synthesis_data.get('executive_summary', ''))} chars")
        console.print(f"  Curated Findings: {len(synthesis_data.get('curated_findings', []))}")
        console.print(f"  Charts: {len(synthesis_data.get('chart_configs', []))}")
        console.print(f"  Questions: {len(synthesis_data.get('management_questions', []))}")

        # Prompt for decision
        console.print("\n[bold]Options:[/bold]")
        console.print("  [green]1[/green] - Approve and generate final reports")
        console.print("  [yellow]2[/yellow] - Request changes to the draft")
        console.print("  [cyan]3[/cyan] - Regenerate specific sections")
        console.print("  [red]4[/red] - Cancel/Reject")

        # Use TTY-aware prompting
        if _is_interactive_tty():
            choice = Prompt.ask(
                "\n[bold]Your choice[/bold]",
                choices=["1", "2", "3", "4"],
                default="1"
            )
        else:
            choice = _simple_prompt("\nYour choice", ["1", "2", "3", "4"], "1")

        if choice == "1":
            console.print("[green]✓ Draft approved - generating final reports[/green]")
            return GateResult(decision=GateDecision.APPROVE, approved=True)

        elif choice == "2":
            if _is_interactive_tty():
                feedback = Prompt.ask(
                    "[yellow]What changes do you want?[/yellow]\n"
                    "(Describe the changes needed)"
                )
            else:
                feedback = _simple_prompt("What changes do you want?")
            return GateResult(
                decision=GateDecision.MODIFY,
                approved=False,
                feedback=feedback,
            )

        elif choice == "3":
            console.print("[cyan]Which sections to regenerate?[/cyan]")
            console.print("  1 - Executive Summary")
            console.print("  2 - Curated Findings")
            console.print("  3 - Charts")
            console.print("  4 - Questions")

            if _is_interactive_tty():
                sections = Prompt.ask(
                    "Enter section numbers (comma-separated)",
                    default="1"
                )
            else:
                sections = _simple_prompt("Enter section numbers (comma-separated)", default="1")

            return GateResult(
                decision=GateDecision.MODIFY,
                approved=False,
                modifications={"regenerate_sections": sections.split(",")},
            )

        else:
            console.print("[red]✗ Draft rejected[/red]")
            return GateResult(decision=GateDecision.REJECT, approved=False)

    def _display_validation_summary(self, validation_results: Dict[str, Any]) -> None:
        """Display a summary of validation results.

        Args:
            validation_results: Validation results to display
        """
        if not validation_results:
            return

        table = Table(title="Quality Validation", show_header=True)
        table.add_column("Check", style="cyan")
        table.add_column("Status", justify="center")
        table.add_column("Score", justify="right")

        for check in validation_results.get("checks", []):
            status = "✅" if check.get("passed", False) else "❌"
            score = f"{check.get('score', 0):.0%}"
            table.add_row(check.get("check", "Unknown"), status, score)

        console.print(table)

        overall = validation_results.get("overall_passed", False)
        score = validation_results.get("overall_score", 0)

        if overall:
            console.print(f"\n[green]Overall: PASSED ({score:.0%})[/green]")
        else:
            console.print(f"\n[yellow]Overall: NEEDS ATTENTION ({score:.0%})[/yellow]")

    def quick_confirm(self, message: str, default: bool = True) -> bool:
        """Quick confirmation prompt.

        Args:
            message: Message to display
            default: Default choice

        Returns:
            True if confirmed, False otherwise
        """
        if not self.interactive:
            return default

        if _is_interactive_tty():
            return Confirm.ask(message, default=default)
        else:
            return _simple_confirm(message, default=default)

    def gate_investigation(
        self,
        investigation_display: str,
        candidates: List[Any],
    ) -> "InvestigationGateResult":
        """Gate: User decides how to handle investigation candidates.

        Args:
            investigation_display: Formatted investigation candidates for display
            candidates: List of InvestigationCandidate objects

        Returns:
            InvestigationGateResult with user's decisions
        """
        console.print("\n")
        console.print(Panel(
            "[bold blue]INVESTIGATION GATE[/bold blue]\n\n"
            "Some findings could benefit from additional investigation.\n"
            "You can provide clarifications, documents, or skip.",
            title="🔍 Investigation Opportunity",
            border_style="blue"
        ))

        console.print("\n")
        console.print(investigation_display)

        if not self.interactive:
            console.print("[dim]Auto-skipping investigation in non-interactive mode[/dim]")
            return InvestigationGateResult(
                decision=GateDecision.APPROVE,
                proceed=True,
                selected_candidates=[],
                responses={},
                skip_all=True,
            )

        # Prompt for decision
        console.print("\n[bold]Options:[/bold]")
        console.print("  [green]1[/green] - Address specific findings (enter IDs)")
        console.print("  [yellow]2[/yellow] - Provide additional documents")
        console.print("  [cyan]3[/cyan] - Answer all questions interactively")
        console.print("  [white]4[/white] - Skip investigation and proceed")

        # Use TTY-aware prompting
        if _is_interactive_tty():
            choice = Prompt.ask(
                "\n[bold]Your choice[/bold]",
                choices=["1", "2", "3", "4"],
                default="4"
            )
        else:
            choice = _simple_prompt("\nYour choice", ["1", "2", "3", "4"], "4")

        if choice == "1":
            # Select specific findings
            if _is_interactive_tty():
                ids_input = Prompt.ask(
                    "[green]Enter finding IDs to investigate (comma-separated)[/green]"
                )
            else:
                ids_input = _simple_prompt("Enter finding IDs to investigate (comma-separated)")
            selected_ids = [id.strip() for id in ids_input.split(",") if id.strip()]

            # Collect responses for selected
            responses = {}
            for candidate in candidates:
                if candidate.id in selected_ids:
                    if candidate.questions:
                        console.print(f"\n[bold]Regarding: {candidate.finding.get('title', 'Unknown')}[/bold]")
                        for q in candidate.questions:
                            if _is_interactive_tty():
                                response = Prompt.ask(f"  {q}")
                            else:
                                response = _simple_prompt(f"  {q}")
                            responses[candidate.id] = response
                            break  # One response per candidate for now

            return InvestigationGateResult(
                decision=GateDecision.MODIFY,
                proceed=True,
                selected_candidates=selected_ids,
                responses=responses,
                skip_all=False,
            )

        elif choice == "2":
            # Document provision
            console.print("\n[yellow]Please add documents to the workspace and run again,[/yellow]")
            console.print("[yellow]or specify paths to existing files.[/yellow]")
            if _is_interactive_tty():
                doc_input = Prompt.ask(
                    "Document paths (comma-separated, or 'skip' to continue)",
                    default="skip"
                )
            else:
                doc_input = _simple_prompt("Document paths (comma-separated, or 'skip' to continue)", default="skip")

            if doc_input.lower() == "skip":
                return InvestigationGateResult(
                    decision=GateDecision.APPROVE,
                    proceed=True,
                    selected_candidates=[],
                    responses={},
                    skip_all=True,
                )

            docs = [d.strip() for d in doc_input.split(",") if d.strip()]
            return InvestigationGateResult(
                decision=GateDecision.ADD,
                proceed=True,
                selected_candidates=[],
                responses={},
                documents_provided=docs,
                skip_all=False,
            )

        elif choice == "3":
            # Answer all questions
            responses = {}
            for candidate in candidates:
                if candidate.questions:
                    console.print(f"\n[bold]Regarding: {candidate.finding.get('title', 'Unknown')}[/bold]")
                    console.print(f"[dim]{candidate.reason_detail}[/dim]")
                    for q in candidate.questions:
                        if _is_interactive_tty():
                            response = Prompt.ask(f"  {q}")
                        else:
                            response = _simple_prompt(f"  {q}")
                        if response:
                            responses[candidate.id] = response
                            break

            return InvestigationGateResult(
                decision=GateDecision.MODIFY,
                proceed=True,
                selected_candidates=list(responses.keys()),
                responses=responses,
                skip_all=False,
            )

        else:
            # Skip
            console.print("[dim]Skipping investigation phase[/dim]")
            return InvestigationGateResult(
                decision=GateDecision.APPROVE,
                proceed=True,
                selected_candidates=[],
                responses={},
                skip_all=True,
            )


@dataclass
class InvestigationGateResult:
    """Result from the investigation gate."""

    decision: GateDecision
    proceed: bool  # Whether to proceed with audit
    selected_candidates: List[str]  # IDs of candidates to investigate
    responses: Dict[str, str]  # candidate_id -> user response
    documents_provided: List[str] = field(default_factory=list)
    skip_all: bool = False


class GateLogger:
    """Logs all gate decisions for audit trail."""

    def __init__(self, log_path: Path):
        """Initialize gate logger.

        Args:
            log_path: Path to log file
        """
        self.log_path = log_path
        self.log_path.parent.mkdir(parents=True, exist_ok=True)

    def log_decision(
        self,
        gate_name: str,
        result: GateResult,
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Log a gate decision.

        Args:
            gate_name: Name of the gate
            result: The gate result
            context: Additional context
        """
        from datetime import datetime

        entry = {
            "timestamp": datetime.now().isoformat(),
            "gate": gate_name,
            "decision": result.decision.value,
            "approved": result.approved,
            "modifications": result.modifications,
            "additions": result.additions,
            "feedback": result.feedback,
            "context": context,
        }

        # Append to log file
        with open(self.log_path, "a") as f:
            f.write(json.dumps(entry) + "\n")

    def get_history(self) -> List[Dict[str, Any]]:
        """Get all logged gate decisions.

        Returns:
            List of gate decision entries
        """
        if not self.log_path.exists():
            return []

        entries = []
        with open(self.log_path, "r") as f:
            for line in f:
                if line.strip():
                    entries.append(json.loads(line))

        return entries
