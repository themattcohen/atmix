"""Agent dispatcher for running analysis agents."""

import asyncio
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Dict, List, Optional

from ..models.findings import AgentResult

if TYPE_CHECKING:
    from ..agents.base import BaseAgent
    from .session import Session


class AgentDispatcher:
    """Dispatches and manages agent execution."""

    def __init__(self, session: "Session"):
        self.session = session
        self._agents: Dict[str, "BaseAgent"] = {}

    def register(self, agent: "BaseAgent") -> None:
        """Register an agent for dispatch."""
        self._agents[agent.name] = agent

    def get_agent(self, name: str) -> Optional["BaseAgent"]:
        """Get registered agent by name."""
        return self._agents.get(name)

    def list_agents(self) -> list[str]:
        """List all registered agent names."""
        return list(self._agents.keys())

    async def run_agent(self, agent_name: str) -> AgentResult:
        """Run a single agent."""
        agent = self._agents.get(agent_name)
        if not agent:
            return AgentResult(
                agent_name=agent_name,
                error=f"Agent not found: {agent_name}",
                confidence=0.0,
            )

        start_time = datetime.now()

        try:
            # Build context for the agent
            from ..agents.base import AnalysisContext

            context = AnalysisContext(
                workspace=self.session.workspace,
                session_state=self.session.state,
                input_files=self.session.state.input_files,
                cleaned_files=self.session.state.cleaned_files,
                derived_files=self.session.state.derived_files,
                findings=list(self.session.state.findings),
                gaps=list(self.session.state.gaps),
            )

            # Check if agent can run
            if not agent.can_run(context):
                # Mark as failed so we don't retry
                self.session.state.mark_agent_failed(
                    agent_name,
                    f"Missing required inputs: {agent.required_inputs}"
                )
                self.session.save()
                return AgentResult(
                    agent_name=agent_name,
                    error=f"Agent cannot run: missing required inputs",
                    confidence=0.0,
                )

            # Run the agent
            result = await agent.analyze(context)
            result.duration_seconds = (datetime.now() - start_time).total_seconds()

            # Incorporate results into session
            for finding in result.findings:
                finding.source_agent = agent_name
                self.session.state.add_finding(finding)

            for gap in result.gaps:
                gap.source_agent = agent_name
                self.session.state.add_gap(gap)

            for question in result.questions:
                question.source_agent = agent_name
                self.session.state.add_question(question)

            for suggestion in result.suggested_agents:
                suggestion.source_agent = agent_name
                self.session.state.suggest_agent(suggestion)

            # Update file inventories
            for output in result.outputs:
                self.session.state.derived_files[output] = str(
                    self.session.workspace / "derived" / output
                )

            # Mark agent complete
            self.session.state.mark_agent_complete(agent_name, result.to_dict())
            self.session.save()

            return result

        except Exception as e:
            error_msg = f"{type(e).__name__}: {str(e)}"
            self.session.state.mark_agent_failed(agent_name, error_msg)
            self.session.save()

            return AgentResult(
                agent_name=agent_name,
                error=error_msg,
                confidence=0.0,
                duration_seconds=(datetime.now() - start_time).total_seconds(),
            )

    async def run_parallel(self, agent_names: list[str]) -> list[AgentResult]:
        """Run multiple agents in parallel."""
        tasks = [self.run_agent(name) for name in agent_names]
        return await asyncio.gather(*tasks)

    def run_sync(self, agent_name: str) -> AgentResult:
        """Run agent synchronously."""
        return asyncio.run(self.run_agent(agent_name))

    def run_parallel_sync(self, agent_names: list[str]) -> list[AgentResult]:
        """Run multiple agents in parallel, synchronously."""
        return asyncio.run(self.run_parallel(agent_names))
