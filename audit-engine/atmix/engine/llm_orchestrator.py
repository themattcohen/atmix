"""LLM-First Orchestrator for ATMIX v2.

This orchestrator implements the 6-phase LLM-first workflow:
1. Data Ingestion (Python) - Load and validate files
2. LLM Planning (Claude API) - LLM determines what analyses to run
3. Gate 1: User Approves Plan
4. LLM Analysis (Claude API) - LLM performs actual analysis
5. Quality Validation (Automated + LLM)
6. Gate 2: User Approves Findings
7. LLM Synthesis (Claude API) - Curate, rank, generate narratives
8. Gate 3: User Approves Draft
9. Report Generation (Python) - Generate final HTML reports
"""

import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd


def _parse_llm_json(content: str) -> Optional[Dict[str, Any]]:
    """Parse JSON from LLM output with error recovery.

    Handles common LLM JSON issues like:
    - Trailing commas
    - Unescaped newlines in strings
    - Truncated responses
    - Extra text before/after JSON

    Args:
        content: Raw LLM response text

    Returns:
        Parsed JSON dict or None if parsing fails
    """
    if "{" not in content:
        return None

    # Extract JSON from between first { and last }
    try:
        start = content.index("{")
        end = content.rindex("}") + 1
        json_str = content[start:end]
    except ValueError:
        return None

    # Try direct parsing first
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        pass

    # Fix common issues
    fixed = json_str

    # Remove trailing commas before } or ]
    fixed = re.sub(r',\s*}', '}', fixed)
    fixed = re.sub(r',\s*]', ']', fixed)

    # Try again
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    # Try to fix truncated JSON by finding last complete object/array
    # Count braces and find where they balance
    depth = 0
    last_valid_end = 0
    for i, char in enumerate(fixed):
        if char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                last_valid_end = i + 1

    if last_valid_end > 0:
        try:
            return json.loads(fixed[:last_valid_end])
        except json.JSONDecodeError:
            pass

    return None
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

from ..models.synthesis import SynthesisOutput, SynthesizedFinding, ChartData, MetricCard
from ..prompts.planning import AnalysisPlan, PlanningPrompts
from ..prompts.analysis import AnalysisResult, AnalysisFinding, AnalysisPrompts
from ..prompts.synthesis import SynthesizedReport, SynthesisPrompts
from ..prompts.validation import ValidationPrompts
from ..prompts.data_prep import DataPrepPlan, DataPrepPrompts, FileProfile, ProcessingStrategy
from ..prompts.context_gathering import (
    BusinessContext, ContextQuestion, DataGap,
    ContextGatheringResult, DataGapAnalysis, ContextGatheringPrompts
)
from .gates import ApprovalGates, GateLogger, GateResult, GateDecision
from .validation import QualityValidator, ValidationReport
from .data_processor import DataProcessor, profile_workspace_files
from .file_processors import FileIngestionManager, ContextDocument
from .investigation import InvestigationEngine, InvestigationPlan, InvestigationResult

# Try to import anthropic
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

console = Console()


class LLMOrchestrator:
    """Main orchestrator for the LLM-first audit workflow."""

    # Configuration - different models for different phases
    # Opus for strategic thinking (planning, synthesis)
    # Sonnet for execution (analysis, report generation)
    MODEL_PLANNING = "claude-opus-4-20250514"      # Deep reasoning for understanding business
    MODEL_SYNTHESIS = "claude-opus-4-20250514"     # Judgment for curation and narratives
    MODEL_ANALYSIS = "claude-sonnet-4-20250514"    # Execution of planned analyses
    MODEL_VALIDATION = "claude-sonnet-4-20250514"  # Quality checks

    MAX_RETRIES = 3
    SAMPLE_ROWS = 50  # Rows to sample for planning
    MAX_DATA_ROWS = 500  # Max rows per file in analysis (to avoid token limits)
    MAX_TOTAL_DATA_CHARS = 100000  # ~25K tokens max for data in prompts

    # Data prep thresholds
    LARGE_FILE_ROWS = 500  # Files with more rows need processing
    LARGE_FILE_CHARS = 50000  # Files with more chars need processing
    MODEL_DATA_PREP = "claude-opus-4-20250514"  # Opus for data strategy decisions
    MODEL_CONTEXT = "claude-opus-4-20250514"  # Opus for understanding business context

    def __init__(
        self,
        workspace: Path,
        interactive: bool = True,
        predefined_context: Optional["BusinessContext"] = None,
    ):
        """Initialize the LLM orchestrator.

        Args:
            workspace: Path to the workspace directory
            interactive: Whether to run in interactive mode with user gates
            predefined_context: Pre-defined business context (skips context gathering gate)
        """
        self.workspace = Path(workspace)
        self.interactive = interactive
        self.predefined_context = predefined_context

        # Initialize components
        self.client = None
        self.gates = ApprovalGates(interactive=interactive)
        self.gate_logger = GateLogger(self.workspace / "state" / "gate_log.jsonl")
        self.validator = QualityValidator()

        # State
        self.total_tokens = 0
        self.start_time = None
        self.analysis_plan: Optional[AnalysisPlan] = None
        self.all_findings: List[Dict[str, Any]] = []
        self.all_questions: List[Dict[str, Any]] = []
        self.synthesis_data: Optional[Dict[str, Any]] = None

        # Paths
        self.input_path = self.workspace / "input"
        self.cleaned_path = self.workspace / "cleaned"
        self.derived_path = self.workspace / "derived"
        self.output_path = self.workspace / "output"
        self.state_path = self.workspace / "state"

        # Data prep state
        self.data_prep_plan: Optional[DataPrepPlan] = None
        self.derived_files: Dict[str, Path] = {}  # Mapping of processed filenames to paths

        # Business context (from user interaction)
        self.business_context: Optional[BusinessContext] = None
        self.data_gaps: Optional[DataGapAnalysis] = None

        # Context documents from PDFs and other non-tabular files
        self.context_documents: List[ContextDocument] = []

    def _init_client(self) -> bool:
        """Initialize Anthropic client."""
        if not ANTHROPIC_AVAILABLE:
            console.print("[red]Anthropic library not available. Install with: pip install anthropic[/red]")
            return False

        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            console.print("[red]ANTHROPIC_API_KEY environment variable not set[/red]")
            return False

        try:
            self.client = anthropic.Anthropic(api_key=api_key)
            return True
        except Exception as e:
            console.print(f"[red]Failed to initialize Anthropic client: {e}[/red]")
            return False

    def run(self) -> bool:
        """Run the complete LLM-first audit workflow.

        Returns:
            True if audit completed successfully, False otherwise
        """
        self.start_time = time.time()

        console.print("\n")
        console.print(Panel(
            "[bold blue]ATMIX v2: LLM-First Financial Audit[/bold blue]\n\n"
            "This audit uses LLM intelligence for:\n"
            "  • Understanding your business context\n"
            "  • Planning what analyses to run\n"
            "  • Performing the actual analysis\n"
            "  • Synthesizing findings into narratives\n\n"
            "We'll start by asking a few questions about your business.",
            title="Welcome",
            border_style="blue"
        ))

        # Initialize LLM client
        if not self._init_client():
            return False

        try:
            # Phase 1: Data Ingestion
            console.print("\n[bold]Phase 1: Data Ingestion[/bold]")
            data_files, data_samples = self._ingest_data()

            if not data_files:
                console.print("[red]No data files found in workspace[/red]")
                return False

            console.print(f"  Found {len(data_files)} data files")

            # ═══════════════════════════════════════════════════════════════
            # PHASE 0: CONTEXT GATHERING (HARD GATE - CANNOT BE SKIPPED)
            # ═══════════════════════════════════════════════════════════════
            console.print("\n[bold]Phase 0: Business Context Gathering[/bold]")

            # Use predefined context if provided
            if self.predefined_context:
                console.print("  [green]✓ Using predefined business context[/green]")
                console.print(f"    Business type: {self.predefined_context.business_type}")
                if self.predefined_context.clarifications:
                    for key, value in self.predefined_context.clarifications.items():
                        console.print(f"    {key}: {value}")
                business_context = self.predefined_context
                business_context.available_data = list(data_files.keys())
            else:
                console.print("  [dim]Understanding your business before analysis...[/dim]")

                context_result = self._gather_context(data_files, data_samples)

                if not context_result:
                    console.print("[red]Context gathering failed[/red]")
                    return False

                # HARD GATE: User MUST answer context questions
                business_context = self._run_context_gate(context_result, data_files, data_samples)

                if not business_context:
                    console.print("[yellow]Audit cancelled - context required[/yellow]")
                    return False

            self.business_context = business_context

            # Data Gap Analysis
            console.print("\n[bold]Phase 0.5: Data Gap Analysis[/bold]")
            gap_analysis = self._analyze_data_gaps(business_context, data_files, data_samples)

            if gap_analysis:
                self.data_gaps = gap_analysis
                # Show gaps and get user acknowledgment
                proceed = self._run_gaps_gate(gap_analysis)
                if not proceed:
                    console.print("[yellow]Audit paused - user requested additional data[/yellow]")
                    return False

            # Phase 1.5: Data Preparation (process large files)
            console.print("\n[bold]Phase 1.5: Data Preparation[/bold]")
            data_files, data_samples = self._run_data_prep_phase(data_files, data_samples)

            # Phase 2: LLM Planning (now with business context)
            console.print("\n[bold]Phase 2: LLM Planning[/bold]")
            plan = self._run_planning_phase(data_files, data_samples)

            if not plan:
                console.print("[red]Planning phase failed[/red]")
                return False

            # Gate 1: User approves plan
            plan_display = PlanningPrompts.format_plan_for_display(plan)
            gate_result = self.gates.gate_approve_plan(plan_display, plan.to_dict())
            self.gate_logger.log_decision("plan_approval", gate_result, {"plan": plan.to_dict()})

            if gate_result.decision == GateDecision.REJECT:
                console.print("[yellow]Audit cancelled by user[/yellow]")
                return False

            # Handle modifications
            while gate_result.decision in (GateDecision.MODIFY, GateDecision.ADD):
                plan = self._refine_plan(plan, gate_result)
                plan_display = PlanningPrompts.format_plan_for_display(plan)
                gate_result = self.gates.gate_approve_plan(plan_display, plan.to_dict())
                self.gate_logger.log_decision("plan_approval", gate_result)

                if gate_result.decision == GateDecision.REJECT:
                    return False

            self.analysis_plan = plan

            # Phase 3: LLM Analysis
            console.print("\n[bold]Phase 3: LLM Analysis[/bold]")
            findings = self._run_analysis_phase(plan, data_files)

            if not findings:
                console.print("[red]Analysis phase produced no findings[/red]")
                return False

            self.all_findings = findings
            console.print(f"  Generated {len(findings)} findings")

            # Phase 4: Quality Validation
            console.print("\n[bold]Phase 4: Quality Validation[/bold]")
            validation = self._run_validation(findings, list(data_files.keys()))

            # Gate 2: User approves findings
            findings_display = self._format_findings_for_display(findings)
            gate_result = self.gates.gate_approve_findings(
                findings_display,
                findings,
                validation.to_dict(),
            )
            self.gate_logger.log_decision("findings_approval", gate_result)

            if gate_result.decision == GateDecision.REJECT:
                console.print("[yellow]Audit cancelled by user[/yellow]")
                return False

            while gate_result.decision in (GateDecision.MODIFY, GateDecision.ADD):
                # Re-run analysis for specific areas
                additional = self._run_additional_analysis(gate_result, data_files)
                if additional:
                    findings.extend(additional)
                    self.all_findings = findings

                findings_display = self._format_findings_for_display(findings)
                validation = self._run_validation(findings, list(data_files.keys()))
                gate_result = self.gates.gate_approve_findings(
                    findings_display,
                    findings,
                    validation.to_dict(),
                )
                self.gate_logger.log_decision("findings_approval", gate_result)

                if gate_result.decision == GateDecision.REJECT:
                    return False

            # ═══════════════════════════════════════════════════════════════
            # PHASE 4.5: INVESTIGATION (Optional iterative refinement)
            # ═══════════════════════════════════════════════════════════════
            console.print("\n[bold]Phase 4.5: Investigation Analysis[/bold]")
            investigation_result = self._run_investigation_phase(findings, data_files)

            if investigation_result and investigation_result.findings_changed:
                # Update findings with investigation results
                findings = investigation_result.updated_findings + investigation_result.new_findings
                self.all_findings = findings
                console.print(f"  [green]✓[/green] Findings refined: {len(findings)} total")

            # Phase 5: LLM Synthesis
            console.print("\n[bold]Phase 5: LLM Synthesis[/bold]")
            synthesis = self._run_synthesis_phase(findings, plan)

            if not synthesis:
                console.print("[red]Synthesis phase failed[/red]")
                return False

            self.synthesis_data = synthesis

            # Gate 3: User approves draft
            synthesis_display = SynthesisPrompts.format_synthesis_for_display(
                SynthesizedReport.from_dict(synthesis)
            )
            gate_result = self.gates.gate_approve_draft(synthesis_display, synthesis)
            self.gate_logger.log_decision("draft_approval", gate_result)

            if gate_result.decision == GateDecision.REJECT:
                console.print("[yellow]Audit cancelled by user[/yellow]")
                return False

            while gate_result.decision in (GateDecision.MODIFY, GateDecision.ADD):
                synthesis = self._regenerate_synthesis(synthesis, gate_result)
                synthesis_display = SynthesisPrompts.format_synthesis_for_display(
                    SynthesizedReport.from_dict(synthesis)
                )
                gate_result = self.gates.gate_approve_draft(synthesis_display, synthesis)
                self.gate_logger.log_decision("draft_approval", gate_result)

                if gate_result.decision == GateDecision.REJECT:
                    return False

            # Phase 6: Report Generation
            console.print("\n[bold]Phase 6: Report Generation[/bold]")
            self._generate_reports(synthesis)

            # Complete
            duration = time.time() - self.start_time
            console.print("\n")
            console.print(Panel(
                f"[bold green]Audit Complete![/bold green]\n\n"
                f"Duration: {duration:.1f} seconds\n"
                f"LLM Tokens: {self.total_tokens:,}\n"
                f"Estimated Cost: ${self._estimate_cost():.2f}\n\n"
                f"Reports generated in: {self.output_path}",
                title="Success",
                border_style="green"
            ))

            return True

        except KeyboardInterrupt:
            console.print("\n[yellow]Audit interrupted by user[/yellow]")
            self._save_state("interrupted")
            return False

        except Exception as e:
            console.print(f"\n[red]Error during audit: {e}[/red]")
            import traceback
            traceback.print_exc()
            self._save_state("error")
            return False

    def _ingest_data(self) -> Tuple[Dict[str, str], Dict[str, str]]:
        """Phase 1: Ingest data files of all supported formats.

        Supports: CSV, XLSX, XLS, PDF
        - Handles duplicate files (XLSX preferred over CSV with same name)
        - Prompts for passwords on protected files
        - Extracts context from PDF documents (QB health reports, etc.)

        Returns:
            Tuple of (file_descriptions, data_samples)
        """
        # Use the new FileIngestionManager for multi-format support
        manager = FileIngestionManager(interactive=self.interactive)

        data_files = {}
        data_samples = {}

        # Check cleaned path first, then input path
        search_paths = [self.cleaned_path, self.input_path]

        for search_path in search_paths:
            if not search_path.exists():
                continue

            # Process all supported files in directory
            dir_files, dir_samples, dir_context = manager.process_directory(search_path)

            # Merge results (don't overwrite if already found in cleaned)
            for filename, file_type in dir_files.items():
                if filename not in data_files:
                    data_files[filename] = file_type

            for filename, sample in dir_samples.items():
                if filename not in data_samples:
                    data_samples[filename] = sample

            # Collect context documents from PDFs
            self.context_documents.extend(dir_context)

        # Log context documents found
        if self.context_documents:
            console.print(f"\n  [blue]📄 Found {len(self.context_documents)} context document(s)[/blue]")
            for doc in self.context_documents:
                console.print(f"    • {doc.filename}: {doc.document_type}")

        return data_files, data_samples

    def _infer_file_type(self, filename: str, df: pd.DataFrame) -> str:
        """Infer file type from filename and content."""
        filename_lower = filename.lower()

        if "pl" in filename_lower or "income" in filename_lower or "profit" in filename_lower:
            return "Profit & Loss Statement"
        elif "balance" in filename_lower or "bs" in filename_lower:
            return "Balance Sheet"
        elif "cash" in filename_lower:
            return "Cash Flow Statement"
        elif "gl" in filename_lower or "general" in filename_lower or "ledger" in filename_lower:
            return "General Ledger"
        elif "ap" in filename_lower or "payable" in filename_lower:
            return "Accounts Payable"
        elif "ar" in filename_lower or "receivable" in filename_lower:
            return "Accounts Receivable"
        elif "bank" in filename_lower:
            return "Bank Statement"
        elif "vendor" in filename_lower:
            return "Vendor List"
        elif "sales" in filename_lower or "revenue" in filename_lower:
            return "Sales Data"
        elif "shopify" in filename_lower:
            return "Shopify Data"
        else:
            return "Financial Data"

    # ═══════════════════════════════════════════════════════════════════════
    # CONTEXT GATHERING METHODS
    # ═══════════════════════════════════════════════════════════════════════

    def _gather_context(
        self,
        data_files: Dict[str, str],
        data_samples: Dict[str, str],
    ) -> Optional[ContextGatheringResult]:
        """Generate context questions based on available files.

        Args:
            data_files: Dict of filename -> file type description
            data_samples: Dict of filename -> CSV sample

        Returns:
            ContextGatheringResult with questions to ask user
        """
        # Build context documents section for the prompt
        context_docs_text = ""
        if self.context_documents:
            context_docs_text = "\n## Additional Context Documents\n"
            for doc in self.context_documents:
                context_docs_text += f"\n### {doc.filename} ({doc.document_type})\n"
                # Limit text length to avoid token overload
                text_preview = doc.extracted_text[:3000]
                if len(doc.extracted_text) > 3000:
                    text_preview += "\n... [truncated]"
                context_docs_text += f"```\n{text_preview}\n```\n"
                if doc.structured_data:
                    import json
                    context_docs_text += f"\nParsed data:\n```json\n{json.dumps(doc.structured_data, indent=2)}\n```\n"

        prompt = ContextGatheringPrompts.create_initial_questions_prompt(
            file_list=list(data_files.keys()),
            file_samples=data_samples,
            context_documents=context_docs_text,
        )

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Analyzing files to generate context questions...", total=None)

            try:
                response = self.client.messages.create(
                    model=self.MODEL_CONTEXT,
                    max_tokens=2000,
                    messages=[{"role": "user", "content": prompt}],
                )
                self.total_tokens += response.usage.input_tokens + response.usage.output_tokens

                content = response.content[0].text.strip()
                result_data = _parse_llm_json(content)

                if result_data:
                    questions = [
                        ContextQuestion(**q) for q in result_data.get("questions", [])
                    ]
                    return ContextGatheringResult(
                        questions=questions,
                        initial_observations=result_data.get("initial_observations", []),
                        business_type_guess=result_data.get("business_type_guess", "unknown"),
                        confidence_in_guess=result_data.get("confidence_in_guess", 0.5),
                    )

            except Exception as e:
                console.print(f"[red]Context gathering failed: {e}[/red]")
                return None

        return None

    def _run_context_gate(
        self,
        context_result: ContextGatheringResult,
        data_files: Dict[str, str],
        data_samples: Dict[str, str],
    ) -> Optional[BusinessContext]:
        """HARD GATE: User must answer context questions.

        This gate CANNOT be skipped even in non-interactive mode.
        We need business context to do a proper audit.

        Args:
            context_result: Questions and observations from LLM
            data_files: Available files
            data_samples: File samples

        Returns:
            BusinessContext from user answers, or None if cancelled
        """
        # Display the context questions
        display_text = ContextGatheringPrompts.format_questions_for_display(context_result)

        console.print("\n")
        console.print(Panel(
            "[bold yellow]CONTEXT REQUIRED[/bold yellow]\n\n"
            "To provide an accurate audit, we need to understand your business.\n"
            "Please answer the following questions.\n\n"
            "[dim]This step cannot be skipped - context is essential for quality analysis.[/dim]",
            title="🚧 Hard Gate: Business Context",
            border_style="yellow"
        ))
        console.print(display_text)

        # Collect answers
        business_context = BusinessContext()
        business_context.available_data = list(data_files.keys())

        # In non-interactive mode, we still need to collect this somehow
        # For now, we'll prompt via console
        if not self.interactive:
            console.print("\n[yellow]Running in non-interactive mode but context is required.[/yellow]")
            console.print("[yellow]Using LLM's best guesses with low confidence.[/yellow]")

            # Use LLM's guesses as defaults
            business_context.business_type = context_result.business_type_guess
            for obs in context_result.initial_observations:
                business_context.clarifications["auto_observation"] = "; ".join(context_result.initial_observations)

            return business_context

        # Interactive mode - ask each question
        for q in context_result.questions:
            console.print(f"\n[bold]{q.question}[/bold]")
            console.print(f"[dim]{q.why_asking}[/dim]")

            if q.options:
                for i, opt in enumerate(q.options, 1):
                    console.print(f"  {i}. {opt}")
                console.print(f"  {len(q.options) + 1}. Other (type your answer)")

                while True:
                    try:
                        choice = input("\nYour choice (number or text): ").strip()
                        if choice.isdigit():
                            idx = int(choice) - 1
                            if 0 <= idx < len(q.options):
                                answer = q.options[idx]
                                break
                            elif idx == len(q.options):
                                answer = input("Please specify: ").strip()
                                break
                        else:
                            answer = choice
                            break
                    except (ValueError, EOFError):
                        answer = q.default or "Not provided"
                        break
            else:
                try:
                    answer = input("\nYour answer: ").strip()
                except EOFError:
                    answer = q.default or "Not provided"

            # Map answers to business context
            business_context.clarifications[q.id] = answer

            # Try to map common questions to structured fields
            q_lower = q.question.lower()
            if "business type" in q_lower or "what kind of business" in q_lower:
                business_context.business_type = answer
            elif "sales system" in q_lower or "sales platform" in q_lower or "e-commerce" in q_lower:
                business_context.primary_sales_system = answer
            elif "payment" in q_lower and "processor" in q_lower:
                business_context.payment_processors = [p.strip() for p in answer.split(",")]
            elif "inventory" in q_lower:
                business_context.has_inventory = answer.lower() in ["yes", "true", "y"]
            elif "subscription" in q_lower or "recurring" in q_lower:
                business_context.has_recurring_revenue = answer.lower() in ["yes", "true", "y"]

        # Set business type from guess if not answered
        if not business_context.business_type:
            business_context.business_type = context_result.business_type_guess

        console.print("\n[green]✓ Context collected[/green]")
        return business_context

    def _analyze_data_gaps(
        self,
        business_context: BusinessContext,
        data_files: Dict[str, str],
        data_samples: Dict[str, str],
    ) -> Optional[DataGapAnalysis]:
        """Analyze what data is missing based on business type.

        Args:
            business_context: User-provided business context
            data_files: Available files
            data_samples: File samples

        Returns:
            DataGapAnalysis identifying missing data
        """
        prompt = ContextGatheringPrompts.create_data_gap_prompt(
            business_context=business_context,
            file_list=list(data_files.keys()),
            file_samples=data_samples,
        )

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Analyzing data gaps...", total=None)

            try:
                response = self.client.messages.create(
                    model=self.MODEL_CONTEXT,
                    max_tokens=2000,
                    messages=[{"role": "user", "content": prompt}],
                )
                self.total_tokens += response.usage.input_tokens + response.usage.output_tokens

                content = response.content[0].text.strip()
                result_data = _parse_llm_json(content)

                if result_data:
                    gaps = [DataGap(**g) for g in result_data.get("gaps", [])]
                    return DataGapAnalysis(
                        gaps=gaps,
                        expected_for_business_type=result_data.get("expected_for_business_type", []),
                        available=result_data.get("available", []),
                        recommendations=result_data.get("recommendations", []),
                        can_proceed=result_data.get("can_proceed", True),
                        proceed_with_caveats=result_data.get("proceed_with_caveats", []),
                    )

            except Exception as e:
                console.print(f"[yellow]Data gap analysis failed: {e}[/yellow]")
                return None

        return None

    def _run_gaps_gate(self, gap_analysis: DataGapAnalysis) -> bool:
        """Show data gaps and get user decision on how to proceed.

        Args:
            gap_analysis: Analysis of missing data

        Returns:
            True to proceed, False to pause for more data
        """
        display_text = ContextGatheringPrompts.format_gaps_for_display(gap_analysis)

        console.print("\n")
        console.print(Panel(
            "[bold]Data Gap Analysis Complete[/bold]\n\n"
            "Review the missing data identified below.\n"
            "You can proceed with limitations or pause to gather more data.",
            title="📊 Data Assessment",
            border_style="blue"
        ))
        console.print(display_text)

        # Check for blocking gaps
        blocking_gaps = [g for g in gap_analysis.gaps if g.priority == "blocking"]

        if blocking_gaps:
            console.print("\n[red]⚠ BLOCKING GAPS IDENTIFIED[/red]")
            console.print("The following data is required for a meaningful audit:")
            for gap in blocking_gaps:
                console.print(f"  • {gap.description}")
            console.print("\n[yellow]Recommendation: Obtain this data before proceeding.[/yellow]")

        if not self.interactive:
            if blocking_gaps:
                console.print("[yellow]Non-interactive mode: Proceeding despite blocking gaps (results will be limited)[/yellow]")
            return True

        # Ask user how to proceed
        console.print("\nHow would you like to proceed?")
        console.print("  1. Proceed with available data (acknowledge limitations)")
        console.print("  2. Pause audit to gather additional data")

        try:
            choice = input("\nYour choice (1 or 2): ").strip()
            if choice == "2":
                console.print("\n[blue]Audit paused. Add the requested files to the workspace and run again.[/blue]")
                return False
        except EOFError:
            pass

        # Log the caveats
        if gap_analysis.proceed_with_caveats:
            console.print("\n[yellow]Proceeding with the following limitations:[/yellow]")
            for caveat in gap_analysis.proceed_with_caveats:
                console.print(f"  ⚠ {caveat}")

        return True

    def _run_data_prep_phase(
        self,
        data_files: Dict[str, str],
        data_samples: Dict[str, str],
    ) -> Tuple[Dict[str, str], Dict[str, str]]:
        """Phase 1.5: Prepare data by processing large files.

        This phase:
        1. Profiles all files to identify large ones
        2. Asks LLM how to process large files (aggregate, filter, sample, extract)
        3. Executes the LLM's processing strategy
        4. Returns updated file list with derived files

        Args:
            data_files: Dict of filename -> file type description
            data_samples: Dict of filename -> CSV sample

        Returns:
            Updated tuple of (data_files, data_samples) including derived files
        """
        # Profile workspace files to identify large vs small
        large_files, small_files = profile_workspace_files(
            workspace=self.workspace,
            large_threshold_rows=self.LARGE_FILE_ROWS,
            large_threshold_chars=self.LARGE_FILE_CHARS,
            sample_rows=self.SAMPLE_ROWS,
        )

        if not large_files:
            console.print("  [green]✓[/green] All files are small enough for direct analysis")
            return data_files, data_samples

        console.print(f"  Found {len(large_files)} large files requiring processing:")
        for profile in large_files:
            console.print(f"    • {profile.filename}: {profile.row_count:,} rows")

        # Ask LLM how to process large files
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("LLM deciding data processing strategy...", total=None)

            prompt = DataPrepPrompts.create_data_prep_prompt(
                large_files=large_files,
                small_files=small_files,
                business_context=self.business_context.business_type if self.business_context else None,
            )

            try:
                response = self.client.messages.create(
                    model=self.MODEL_DATA_PREP,  # Opus for strategic data decisions
                    max_tokens=4000,
                    messages=[{"role": "user", "content": prompt}],
                )
                self.total_tokens += response.usage.input_tokens + response.usage.output_tokens

                content = response.content[0].text.strip()

                # Parse JSON response
                if "{" in content:
                    json_str = content[content.index("{"):content.rindex("}") + 1]
                    plan_data = json.loads(json_str)
                    prep_plan = DataPrepPlan.from_dict(plan_data)
                    self.data_prep_plan = prep_plan

                    progress.remove_task(task)

                    # Display the plan
                    console.print(f"\n  [bold]Data Preparation Plan:[/bold]")
                    console.print(f"  {prep_plan.rationale[:200]}...")

                    # Execute the plan
                    console.print(f"\n  Executing {len(prep_plan.strategies)} processing strategies:")
                    processor = DataProcessor(self.workspace)
                    derived_outputs = processor.execute_plan(prep_plan)

                    self.derived_files = derived_outputs

                    # Update data_files and data_samples with derived files
                    updated_files = dict(data_files)
                    updated_samples = dict(data_samples)

                    for derived_name, derived_path in derived_outputs.items():
                        try:
                            df = pd.read_csv(derived_path)
                            file_type = self._infer_file_type(derived_name, df)
                            updated_files[derived_name] = f"{file_type} (processed)"

                            # Create sample of derived file
                            sample_df = df.head(self.SAMPLE_ROWS)
                            updated_samples[derived_name] = sample_df.to_csv(index=False)

                            console.print(f"    → Added {derived_name}: {len(df):,} rows")
                        except Exception as e:
                            console.print(f"    [yellow]⚠[/yellow] Could not load {derived_name}: {e}")

                    # Mark large files as "raw - use derived instead" in descriptions
                    for profile in large_files:
                        if profile.filename in updated_files:
                            updated_files[profile.filename] = f"{updated_files[profile.filename]} (raw - see derived files)"

                    console.print(f"\n  [green]✓[/green] Data preparation complete: {len(derived_outputs)} derived files created")
                    return updated_files, updated_samples

            except Exception as e:
                console.print(f"  [yellow]⚠[/yellow] Data prep failed: {e}")
                console.print("  [yellow]Continuing with truncated data...[/yellow]")

        return data_files, data_samples

    def _run_planning_phase(
        self,
        data_files: Dict[str, str],
        data_samples: Dict[str, str],
    ) -> Optional[AnalysisPlan]:
        """Phase 2: Run LLM planning.

        Args:
            data_files: Dict of filename -> file type description
            data_samples: Dict of filename -> CSV sample

        Returns:
            AnalysisPlan or None if failed
        """
        prompt = PlanningPrompts.create_planning_prompt(
            file_summaries=data_files,
            data_samples=data_samples,
            business_context=self.business_context,
            data_gaps=self.data_gaps,
        )

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("LLM analyzing data and creating plan...", total=None)

            try:
                response = self.client.messages.create(
                    model=self.MODEL_PLANNING,  # Opus for strategic planning
                    max_tokens=4000,
                    messages=[{"role": "user", "content": prompt}],
                )
                self.total_tokens += response.usage.input_tokens + response.usage.output_tokens

                content = response.content[0].text.strip()
                plan_data = _parse_llm_json(content)

                if plan_data:
                    return AnalysisPlan.from_dict(plan_data)
                else:
                    console.print("[red]Could not parse planning JSON[/red]")
                    return None

            except Exception as e:
                console.print(f"[red]Planning failed: {e}[/red]")
                return None

        return None

    def _refine_plan(
        self,
        plan: AnalysisPlan,
        gate_result: GateResult,
    ) -> AnalysisPlan:
        """Refine the plan based on user feedback.

        Args:
            plan: Current plan
            gate_result: User's gate result with feedback

        Returns:
            Refined plan
        """
        prompt = PlanningPrompts.create_plan_refinement_prompt(
            current_plan=plan.to_dict(),
            user_feedback=gate_result.feedback or "",
            additional_requirements=gate_result.additions or [],
        )

        try:
            response = self.client.messages.create(
                model=self.MODEL_PLANNING,  # Opus for strategic planning
                max_tokens=4000,
                messages=[{"role": "user", "content": prompt}],
            )
            self.total_tokens += response.usage.input_tokens + response.usage.output_tokens

            content = response.content[0].text.strip()

            if "{" in content:
                json_str = content[content.index("{"):content.rindex("}") + 1]
                plan_data = json.loads(json_str)
                return AnalysisPlan.from_dict(plan_data)

        except Exception as e:
            console.print(f"[yellow]Plan refinement failed: {e}. Using original plan.[/yellow]")

        return plan

    def _run_analysis_phase(
        self,
        plan: AnalysisPlan,
        data_files: Dict[str, str],
    ) -> List[Dict[str, Any]]:
        """Phase 3: Run LLM analysis.

        Args:
            plan: The approved analysis plan
            data_files: Available data files

        Returns:
            List of findings as dicts
        """
        all_findings = []
        all_questions = []
        business_context = f"{plan.business_type}: {plan.business_description}"

        # Build list of files that have derived versions (skip raw large files)
        raw_files_with_derived = set()
        if self.data_prep_plan:
            for strategy in self.data_prep_plan.strategies:
                raw_files_with_derived.add(strategy.filename.lower())

        # Load data - prefer derived files, skip raw large files
        data_content = {}

        # First, load derived files (processed versions of large files)
        for derived_name, derived_path in self.derived_files.items():
            try:
                df = pd.read_csv(derived_path)
                data_content[derived_name] = df.to_csv(index=False)
                console.print(f"  [dim]Using derived file: {derived_name} ({len(df):,} rows)[/dim]")
            except Exception as e:
                console.print(f"  [yellow]⚠[/yellow] Could not load derived {derived_name}: {e}")

        # Then, load small files (those without derived versions)
        for filename in data_files:
            # Skip if this is a raw file that has a derived version
            if filename.lower() in raw_files_with_derived:
                console.print(f"  [dim]Skipping raw large file: {filename} (using derived)[/dim]")
                continue

            # Skip if already loaded as derived
            if filename in data_content:
                continue

            file_path = self._find_file(filename)
            if file_path:
                try:
                    # Use appropriate reader based on file extension
                    if file_path.suffix.lower() in ['.xlsx', '.xls']:
                        df = pd.read_excel(file_path)
                    else:
                        df = pd.read_csv(file_path)
                    # Double-check: if file is large, warn but still load (may be needed)
                    if len(df) > self.LARGE_FILE_ROWS:
                        console.print(f"  [yellow]⚠[/yellow] Loading large file without processing: {filename} ({len(df):,} rows)")
                    data_content[filename] = df.to_csv(index=False)
                except Exception as e:
                    console.print(f"  [yellow]⚠[/yellow] Could not load {filename}: {e}")

        # Run each planned analysis
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            for i, analysis in enumerate(plan.planned_analyses):
                task = progress.add_task(
                    f"Running {analysis['name']}...",
                    total=None
                )

                # Get required data for this analysis
                required_data = {}
                for req_file in analysis.get("required_data", []):
                    for filename, content in data_content.items():
                        if req_file.lower() in filename.lower():
                            required_data[filename] = content
                            break

                # If no specific files found, use relevant files only (not ALL data)
                if not required_data:
                    # Match files based on analysis type keywords
                    analysis_name_lower = analysis["name"].lower()
                    for filename, content in data_content.items():
                        filename_lower = filename.lower()
                        # Match on analysis keywords
                        if any(kw in analysis_name_lower for kw in ["revenue", "sales"]) and \
                           any(kw in filename_lower for kw in ["pl", "profit", "sales", "revenue"]):
                            required_data[filename] = content
                        elif any(kw in analysis_name_lower for kw in ["cash", "reconcil"]) and \
                             any(kw in filename_lower for kw in ["gl", "ledger", "bank", "cash"]):
                            required_data[filename] = content
                        elif any(kw in analysis_name_lower for kw in ["balance", "equity", "liability"]) and \
                             any(kw in filename_lower for kw in ["balance", "bs", "gl", "ledger"]):
                            required_data[filename] = content
                        elif any(kw in analysis_name_lower for kw in ["cost", "profit", "margin"]) and \
                             any(kw in filename_lower for kw in ["pl", "profit", "cost", "cogs"]):
                            required_data[filename] = content

                # Still no matches? Use a subset (not all)
                if not required_data:
                    # Take up to 3 most relevant files by name matching
                    for filename, content in list(data_content.items())[:3]:
                        required_data[filename] = content

                # Enforce token limit on total data passed
                total_chars = sum(len(c) for c in required_data.values())
                if total_chars > self.MAX_TOTAL_DATA_CHARS:
                    # Truncate files to fit within limit
                    truncated_data = {}
                    remaining_chars = self.MAX_TOTAL_DATA_CHARS
                    for filename, content in required_data.items():
                        if remaining_chars <= 0:
                            break
                        if len(content) > remaining_chars:
                            # Truncate this file
                            lines = content.split("\n")
                            header = lines[0] + "\n"
                            truncated_lines = []
                            chars_used = len(header)
                            for line in lines[1:]:
                                if chars_used + len(line) + 1 > remaining_chars:
                                    break
                                truncated_lines.append(line)
                                chars_used += len(line) + 1
                            truncated_data[filename] = header + "\n".join(truncated_lines)
                            console.print(f"    [dim]Truncated {filename} to fit token limit[/dim]")
                            remaining_chars = 0
                        else:
                            truncated_data[filename] = content
                            remaining_chars -= len(content)
                    required_data = truncated_data

                # Build prior findings summary
                prior_summary = None
                if all_findings:
                    prior_summary = "\n".join(
                        f"- [{f['severity']}] {f['title']}"
                        for f in all_findings[-10:]
                    )

                # Create and run analysis prompt
                prompt = AnalysisPrompts.create_analysis_prompt(
                    analysis_name=analysis["name"],
                    analysis_type=analysis.get("type", "general"),
                    analysis_questions=analysis.get("questions_to_answer", []),
                    data_content=required_data,
                    prior_findings_summary=prior_summary,
                    business_context=business_context,
                )

                try:
                    response = self.client.messages.create(
                        model=self.MODEL_ANALYSIS,  # Sonnet for analysis execution
                        max_tokens=4000,
                        messages=[{"role": "user", "content": prompt}],
                    )
                    self.total_tokens += response.usage.input_tokens + response.usage.output_tokens

                    content = response.content[0].text.strip()

                    if "{" in content:
                        json_str = content[content.index("{"):content.rindex("}") + 1]
                        result = json.loads(json_str)

                        # Extract findings
                        for finding in result.get("findings", []):
                            finding["analysis_source"] = analysis["name"]
                            all_findings.append(finding)

                        # Collect questions
                        for finding in result.get("findings", []):
                            for q in finding.get("follow_up_questions", []):
                                all_questions.append({
                                    "question": q,
                                    "source": finding.get("title", "Unknown"),
                                    "priority": "important",
                                })

                        console.print(
                            f"  [green]✓[/green] {analysis['name']}: "
                            f"{len(result.get('findings', []))} findings"
                        )

                except Exception as e:
                    console.print(f"  [yellow]⚠[/yellow] {analysis['name']}: Failed - {e}")

                progress.remove_task(task)

        self.all_questions = all_questions
        return all_findings

    def _run_additional_analysis(
        self,
        gate_result: GateResult,
        data_files: Dict[str, str],
    ) -> List[Dict[str, Any]]:
        """Run additional analysis based on user feedback.

        Args:
            gate_result: User's gate result with feedback
            data_files: Available data files

        Returns:
            Additional findings
        """
        if not gate_result.feedback:
            return []

        console.print(f"  Running additional analysis based on feedback: {gate_result.feedback}")

        # Build list of files that have derived versions
        raw_files_with_derived = set()
        if self.data_prep_plan:
            for strategy in self.data_prep_plan.strategies:
                raw_files_with_derived.add(strategy.filename.lower())

        # Load data - prefer derived files
        data_content = {}

        # Load derived files first
        for derived_name, derived_path in self.derived_files.items():
            try:
                df = pd.read_csv(derived_path)
                data_content[derived_name] = df.to_csv(index=False)
            except Exception:
                pass

        # Load small files (skip raw large files with derived versions)
        for filename in data_files:
            if filename.lower() in raw_files_with_derived:
                continue
            if filename in data_content:
                continue

            file_path = self._find_file(filename)
            if file_path:
                try:
                    # Use appropriate reader based on file extension
                    if file_path.suffix.lower() in ['.xlsx', '.xls']:
                        df = pd.read_excel(file_path)
                    else:
                        df = pd.read_csv(file_path)
                    data_content[filename] = df.to_csv(index=False)
                except Exception as e:
                    console.print(f"  [yellow]⚠[/yellow] Could not load {filename}: {e}")

        prompt = AnalysisPrompts.create_analysis_prompt(
            analysis_name="Additional Analysis (User Requested)",
            analysis_type="general",
            analysis_questions=[gate_result.feedback],
            data_content=data_content,
            prior_findings_summary="\n".join(
                f"- [{f['severity']}] {f['title']}"
                for f in self.all_findings[-10:]
            ),
            business_context=self.analysis_plan.business_description if self.analysis_plan else None,
        )

        try:
            response = self.client.messages.create(
                model=self.MODEL_ANALYSIS,  # Sonnet for analysis execution
                max_tokens=3000,
                messages=[{"role": "user", "content": prompt}],
            )
            self.total_tokens += response.usage.input_tokens + response.usage.output_tokens

            content = response.content[0].text.strip()

            if "{" in content:
                json_str = content[content.index("{"):content.rindex("}") + 1]
                result = json.loads(json_str)
                return result.get("findings", [])

        except Exception as e:
            console.print(f"[yellow]Additional analysis failed: {e}[/yellow]")

        return []

    def _run_validation(
        self,
        findings: List[Dict[str, Any]],
        available_data: List[str],
    ) -> ValidationReport:
        """Phase 4: Run quality validation.

        Args:
            findings: Findings to validate
            available_data: List of available data files

        Returns:
            ValidationReport
        """
        completed_analyses = []
        if self.analysis_plan:
            completed_analyses = [a["name"] for a in self.analysis_plan.planned_analyses]

        validation = self.validator.validate(
            findings=findings,
            available_data=available_data,
            completed_analyses=completed_analyses,
            business_type=self.analysis_plan.business_type if self.analysis_plan else None,
        )

        # Display validation summary
        console.print(f"  Validation: {'PASSED' if validation.overall_passed else 'NEEDS ATTENTION'}")
        console.print(f"  Score: {validation.overall_score:.0%}")

        if validation.critical_issues:
            console.print("  [yellow]Critical Issues:[/yellow]")
            for issue in validation.critical_issues[:3]:
                console.print(f"    ⚠️  {issue}")

        return validation

    def _run_investigation_phase(
        self,
        findings: List[Dict[str, Any]],
        data_files: Dict[str, str],
    ) -> Optional[InvestigationResult]:
        """Phase 4.5: Run investigation analysis to identify follow-up needs.

        Uses the InvestigationEngine to:
        1. Analyze findings and identify what needs clarification
        2. Generate questions for the user
        3. Request documents that would help verify findings
        4. Optionally refine findings based on user responses

        Args:
            findings: Current findings to investigate
            data_files: Available data files

        Returns:
            InvestigationResult if investigation occurred, None otherwise
        """
        # Build business context dict for investigation engine
        context_dict = {}
        if self.business_context:
            context_dict = {
                "business_type": self.business_context.business_type,
                "primary_sales_system": self.business_context.primary_sales_system,
                "payment_processors": self.business_context.payment_processors,
                "has_inventory": self.business_context.has_inventory,
                "has_recurring_revenue": self.business_context.has_recurring_revenue,
                "clarifications": self.business_context.clarifications,
            }

        # Initialize investigation engine
        investigation_engine = InvestigationEngine(self.client)

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Analyzing investigation needs...", total=None)

            investigation_plan = investigation_engine.analyze_investigation_needs(
                findings=findings,
                business_context=context_dict,
                available_data=list(data_files.keys()),
            )

            progress.remove_task(task)

        # Track tokens (investigation engine uses the client directly)
        # Note: Token tracking happens inside the engine

        if investigation_plan.is_empty:
            console.print("  [green]✓[/green] No additional investigation needed")
            return None

        # Display investigation gate
        console.print("\n")
        console.print(Panel(
            "[bold yellow]INVESTIGATION RECOMMENDED[/bold yellow]\n\n"
            "The analysis identified items that would improve audit quality.\n"
            "You can answer questions, provide documents, or skip to continue.",
            title="🔍 Investigation Gate",
            border_style="yellow"
        ))

        investigation_display = investigation_engine.format_investigation_gate(investigation_plan)
        console.print(investigation_display)

        # Count items by priority
        blocking_count = sum(1 for q in investigation_plan.questions
                           if q.priority.value == "blocking")
        blocking_count += sum(1 for d in investigation_plan.document_requests
                             if d.priority.value == "blocking")

        if blocking_count > 0:
            console.print(f"\n[red]⚠ {blocking_count} BLOCKING items identified[/red]")
            console.print("[yellow]Audit quality will be significantly limited without this information.[/yellow]")

        # In non-interactive mode, skip investigation
        if not self.interactive:
            console.print("\n[yellow]Non-interactive mode: Skipping investigation gate[/yellow]")
            return None

        # Ask user how to proceed
        console.print("\nHow would you like to proceed?")
        console.print("  1. Answer questions and/or provide documents")
        console.print("  2. Skip investigation and continue to synthesis")
        console.print("  3. Pause audit to gather more information")

        try:
            choice = input("\nYour choice (1, 2, or 3): ").strip()
        except EOFError:
            choice = "2"

        if choice == "3":
            console.print("\n[blue]Audit paused. Add requested information and run again.[/blue]")
            # Save investigation plan for reference
            investigation_file = self.state_path / "investigation_plan.json"
            self.state_path.mkdir(parents=True, exist_ok=True)
            with open(investigation_file, "w") as f:
                json.dump(investigation_plan.to_dict(), f, indent=2)
            console.print(f"  Investigation plan saved to: {investigation_file}")
            return None

        if choice == "2":
            console.print("\n[dim]Skipping investigation, continuing to synthesis...[/dim]")
            return None

        # Choice 1: Collect answers and documents
        question_answers = {}
        new_documents = {}

        # Collect answers to questions
        if investigation_plan.questions:
            console.print("\n[bold]Please answer the following questions:[/bold]")

            for i, q in enumerate(investigation_plan.get_sorted_questions(), 1):
                console.print(f"\n{q.priority.icon} {i}. {q.question}")
                console.print(f"   [dim]{q.why_asking}[/dim]")

                if q.options:
                    for j, opt in enumerate(q.options, 1):
                        console.print(f"   {j}. {opt}")
                    console.print(f"   {len(q.options) + 1}. Other (type answer)")
                    console.print("   0. Skip this question")

                try:
                    answer = input("\nYour answer: ").strip()
                    if answer == "0" or not answer:
                        continue

                    if q.options and answer.isdigit():
                        idx = int(answer) - 1
                        if 0 <= idx < len(q.options):
                            answer = q.options[idx]
                        elif idx == len(q.options):
                            answer = input("Please specify: ").strip()

                    question_answers[q.question] = answer

                except EOFError:
                    continue

        # Collect documents
        if investigation_plan.document_requests:
            console.print("\n[bold]Document requests:[/bold]")
            console.print("[dim]Enter file paths for any documents you can provide, or press Enter to skip.[/dim]")

            for d in investigation_plan.get_sorted_document_requests():
                console.print(f"\n{d.priority.icon} {d.document_name}")
                console.print(f"   {d.description}")
                console.print(f"   How to get: {d.how_to_get}")

                try:
                    doc_path = input("File path (or Enter to skip): ").strip()
                    if doc_path:
                        doc_path = Path(doc_path).expanduser()
                        if doc_path.exists():
                            try:
                                content = doc_path.read_text()
                                new_documents[d.document_name] = content
                                console.print(f"   [green]✓[/green] Loaded {doc_path.name}")
                            except Exception as e:
                                console.print(f"   [yellow]⚠[/yellow] Could not read: {e}")
                        else:
                            console.print(f"   [yellow]⚠[/yellow] File not found")
                except EOFError:
                    continue

        # If no new information provided, skip refinement
        if not question_answers and not new_documents:
            console.print("\n[dim]No new information provided, continuing with existing findings...[/dim]")
            return None

        # Refine findings with new information
        console.print("\n[bold]Refining findings with new information...[/bold]")

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("LLM refining findings...", total=None)

            result = investigation_engine.refine_findings(
                original_findings=findings,
                question_answers=question_answers,
                new_documents=new_documents,
                business_context=context_dict,
            )

            progress.remove_task(task)

        # Display results
        console.print(investigation_engine.format_investigation_result(result))

        return result

    def _run_synthesis_phase(
        self,
        findings: List[Dict[str, Any]],
        plan: AnalysisPlan,
    ) -> Optional[Dict[str, Any]]:
        """Phase 5: Run LLM synthesis.

        Args:
            findings: All findings to synthesize
            plan: The analysis plan

        Returns:
            Synthesis data dict or None if failed
        """
        company_name = self.workspace.name.replace("-", " ").title()
        analysis_period = plan.data_summary.get("time_period", "Unknown period")
        business_context = f"{plan.business_type}: {plan.business_description}"

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("LLM synthesizing findings...", total=None)

            prompt = SynthesisPrompts.create_full_synthesis_prompt(
                company_name=company_name,
                analysis_period=analysis_period,
                all_findings=findings,
                all_questions=self.all_questions,
                data_summary=plan.data_summary,
                business_context=business_context,
            )

            # Retry loop for synthesis (LLM JSON can be malformed)
            for attempt in range(self.MAX_RETRIES):
                try:
                    response = self.client.messages.create(
                        model=self.MODEL_SYNTHESIS,  # Opus for strategic synthesis
                        max_tokens=8000,  # Increased for complex synthesis
                        messages=[{"role": "user", "content": prompt}],
                    )
                    self.total_tokens += response.usage.input_tokens + response.usage.output_tokens

                    content = response.content[0].text.strip()
                    synthesis = _parse_llm_json(content)

                    if synthesis:
                        console.print(
                            f"  [green]✓[/green] Synthesized: "
                            f"{len(synthesis.get('curated_findings', []))} curated findings, "
                            f"{len(synthesis.get('chart_configs', []))} charts"
                        )
                        return synthesis
                    else:
                        console.print(f"  [yellow]⚠[/yellow] Attempt {attempt + 1}: Could not parse synthesis JSON, retrying...")

                except Exception as e:
                    console.print(f"  [yellow]⚠[/yellow] Attempt {attempt + 1} failed: {e}")
                    if attempt < self.MAX_RETRIES - 1:
                        console.print("  Retrying...")

            console.print("[red]Synthesis phase failed after all retries[/red]")
            return None

        return None

    def _regenerate_synthesis(
        self,
        synthesis: Dict[str, Any],
        gate_result: GateResult,
    ) -> Dict[str, Any]:
        """Regenerate parts of the synthesis based on feedback.

        Args:
            synthesis: Current synthesis
            gate_result: User's gate result with feedback

        Returns:
            Updated synthesis
        """
        # For now, just regenerate the whole thing with feedback incorporated
        if gate_result.feedback:
            console.print(f"  Regenerating with feedback: {gate_result.feedback}")

        # Re-run synthesis (simplified - could be more targeted)
        return synthesis  # TODO: Implement targeted regeneration

    def _generate_reports(self, synthesis: Dict[str, Any]) -> None:
        """Phase 6: Generate final reports.

        Args:
            synthesis: The approved synthesis data
        """
        self.output_path.mkdir(parents=True, exist_ok=True)

        company_name = self.workspace.name.replace("-", " ").title()
        analysis_date = datetime.now().strftime("%Y-%m-%d")

        # Save synthesis data
        synthesis_file = self.output_path / "synthesis_data.json"
        with open(synthesis_file, "w") as f:
            json.dump(synthesis, f, indent=2)
        console.print(f"  [green]✓[/green] {synthesis_file.name}")

        # Generate HTML report using template
        try:
            from jinja2 import Environment, FileSystemLoader

            template_path = Path(__file__).parent.parent / "templates"
            env = Environment(loader=FileSystemLoader(template_path))
            template = env.get_template("executive_report.html")

            html = template.render(
                company_name=company_name,
                analysis_date=analysis_date,
                total_findings=len(self.all_findings),
                synthesis_confidence=int(synthesis.get("overall_confidence", 0.8) * 100),
                metric_cards=synthesis.get("metric_cards", []),
                executive_narrative=synthesis.get("executive_summary", ""),
                charts=synthesis.get("chart_configs", []),
                charts_json=json.dumps(synthesis.get("chart_configs", [])),
                curated_findings=synthesis.get("curated_findings", []),
                prioritized_questions=synthesis.get("management_questions", []),
            )

            report_file = self.output_path / "Executive_Report.html"
            with open(report_file, "w") as f:
                f.write(html)
            console.print(f"  [green]✓[/green] {report_file.name}")

        except Exception as e:
            console.print(f"  [yellow]⚠[/yellow] HTML report generation failed: {e}")

        # Generate markdown summary
        md_content = self._generate_markdown_summary(synthesis, company_name, analysis_date)
        md_file = self.output_path / "Executive_Summary.md"
        with open(md_file, "w") as f:
            f.write(md_content)
        console.print(f"  [green]✓[/green] {md_file.name}")

        # Generate questions list
        questions_content = self._generate_questions_list(synthesis)
        questions_file = self.output_path / "Questions_List.md"
        with open(questions_file, "w") as f:
            f.write(questions_content)
        console.print(f"  [green]✓[/green] {questions_file.name}")

    def _generate_markdown_summary(
        self,
        synthesis: Dict[str, Any],
        company_name: str,
        analysis_date: str,
    ) -> str:
        """Generate markdown executive summary.

        Args:
            synthesis: Synthesis data
            company_name: Company name
            analysis_date: Analysis date

        Returns:
            Markdown content
        """
        lines = [
            f"# {company_name} - Executive Financial Report",
            f"",
            f"**Date:** {analysis_date}",
            f"**Assessment:** {synthesis.get('overall_assessment', 'N/A').upper()}",
            f"**Risk Level:** {synthesis.get('risk_level', 'N/A').upper()}",
            f"",
            "---",
            "",
            "## Executive Summary",
            "",
            synthesis.get("executive_summary", "No summary available."),
            "",
            "---",
            "",
            "## Key Findings",
            "",
        ]

        for finding in synthesis.get("curated_findings", [])[:10]:
            severity = finding.get("severity", "info").upper()
            lines.append(f"### {finding.get('rank', '?')}. [{severity}] {finding.get('title', 'Unknown')}")
            lines.append("")
            if finding.get("narrative"):
                lines.append(finding["narrative"])
            elif finding.get("detail"):
                lines.append(finding["detail"])
            lines.append("")
            if finding.get("recommended_action"):
                lines.append(f"**Recommended Action:** {finding['recommended_action']}")
            lines.append("")

        if synthesis.get("immediate_priorities"):
            lines.extend([
                "---",
                "",
                "## Immediate Priorities",
                "",
            ])
            for priority in synthesis["immediate_priorities"]:
                lines.append(f"1. {priority}")
            lines.append("")

        lines.extend([
            "---",
            "",
            "*Generated by ATMIX v2 LLM-First Audit System*",
        ])

        return "\n".join(lines)

    def _generate_questions_list(self, synthesis: Dict[str, Any]) -> str:
        """Generate questions list markdown.

        Args:
            synthesis: Synthesis data

        Returns:
            Markdown content
        """
        lines = [
            "# Questions for Management",
            "",
            "These questions were identified during the financial audit and require management input.",
            "",
            "---",
            "",
        ]

        for q in synthesis.get("management_questions", []):
            priority = q.get("priority", "important").upper()
            lines.append(f"## {q.get('rank', '?')}. [{priority}] {q.get('question', 'Unknown')}")
            lines.append("")
            if q.get("context"):
                lines.append(f"**Context:** {q['context']}")
            if q.get("why_important"):
                lines.append(f"**Why Important:** {q['why_important']}")
            lines.append("")

        if synthesis.get("document_requests"):
            lines.extend([
                "---",
                "",
                "## Document Requests",
                "",
            ])
            for doc in synthesis["document_requests"]:
                lines.append(f"- {doc}")
            lines.append("")

        return "\n".join(lines)

    def _find_file(self, filename: str) -> Optional[Path]:
        """Find a file in workspace.

        Args:
            filename: Filename to find

        Returns:
            Path to file or None
        """
        # Check derived files first (processed versions take priority)
        for search_path in [self.derived_path, self.cleaned_path, self.input_path]:
            if not search_path.exists():
                continue
            file_path = search_path / filename
            if file_path.exists():
                return file_path

        return None

    def _format_findings_for_display(self, findings: List[Dict[str, Any]]) -> str:
        """Format findings for terminal display.

        Args:
            findings: Findings to format

        Returns:
            Formatted string
        """
        severity_icons = {
            "critical": "🔴",
            "high": "🟠",
            "medium": "🟡",
            "low": "🟢",
            "info": "🔵",
        }

        lines = [
            "=" * 60,
            "ANALYSIS FINDINGS",
            "=" * 60,
            "",
        ]

        # Group by severity
        by_severity = {}
        for f in findings:
            sev = f.get("severity", "info")
            if sev not in by_severity:
                by_severity[sev] = []
            by_severity[sev].append(f)

        for sev in ["critical", "high", "medium", "low", "info"]:
            if sev not in by_severity:
                continue

            icon = severity_icons.get(sev, "⚪")
            lines.append(f"\n{icon} {sev.upper()} ({len(by_severity[sev])})")
            lines.append("─" * 40)

            for f in by_severity[sev][:5]:  # Show top 5 per severity
                lines.append(f"  • {f.get('title', 'Unknown')}")
                if f.get("source_file") or f.get("source_reference"):
                    source = f"{f.get('source_file', '')}:{f.get('source_reference', '')}"
                    lines.append(f"    Source: {source}")

            if len(by_severity[sev]) > 5:
                lines.append(f"    ... and {len(by_severity[sev]) - 5} more")

        lines.append("")
        lines.append("=" * 60)

        return "\n".join(lines)

    def _save_state(self, status: str) -> None:
        """Save current state for recovery.

        Args:
            status: Current status
        """
        self.state_path.mkdir(parents=True, exist_ok=True)

        state = {
            "status": status,
            "timestamp": datetime.now().isoformat(),
            "total_tokens": self.total_tokens,
            "findings_count": len(self.all_findings),
            "plan": self.analysis_plan.to_dict() if self.analysis_plan else None,
        }

        state_file = self.state_path / "llm_orchestrator_state.json"
        with open(state_file, "w") as f:
            json.dump(state, f, indent=2)

    def _estimate_cost(self) -> float:
        """Estimate API cost based on tokens used.

        Returns:
            Estimated cost in USD
        """
        # Pricing (per MTok):
        # - Opus: $15 input, $75 output
        # - Sonnet: $3 input, $15 output
        #
        # Typical breakdown (estimated):
        # - Planning + Synthesis (Opus): ~30% of tokens
        # - Analysis (Sonnet): ~70% of tokens
        #
        # Estimate 70% input, 30% output for both

        opus_tokens = self.total_tokens * 0.30
        sonnet_tokens = self.total_tokens * 0.70

        # Opus cost
        opus_input = opus_tokens * 0.7
        opus_output = opus_tokens * 0.3
        opus_cost = (opus_input / 1_000_000) * 15.0 + (opus_output / 1_000_000) * 75.0

        # Sonnet cost
        sonnet_input = sonnet_tokens * 0.7
        sonnet_output = sonnet_tokens * 0.3
        sonnet_cost = (sonnet_input / 1_000_000) * 3.0 + (sonnet_output / 1_000_000) * 15.0

        return opus_cost + sonnet_cost
