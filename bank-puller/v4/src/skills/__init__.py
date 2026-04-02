"""
src/skills/__init__.py

The build_skills factory. Creates a Controller and registers only the
phase-appropriate custom actions via closure-bound factory functions.

Phase -> registered skills:
    LOGIN:      (none — only BrowserUse built-ins needed)
    POST_LOGIN: get_sms_code, generate_totp, wait_for_push,
                answer_security_question, request_human_input,
                dismiss_modal
    NAV:        dismiss_modal, report_observation
    PREPARE:    get_account_info, dismiss_modal
    DOWNLOAD:   check_already_downloaded, save_downloaded_pdf,
                validate_pdf, report_observation, dismiss_modal
    VALIDATE:   (none — pure Python, no Agent)
"""

from __future__ import annotations

from browser_use.controller import Controller

from ..models import JobConfig, Phase


def build_skills(phase: Phase, job: JobConfig) -> Controller:
    """Return a Controller pre-loaded with only the custom actions
    appropriate for the given phase.

    The job parameter is captured by closure inside each skill function,
    so skills can read account identifiers, paths, and credentials
    without receiving them as LLM-controlled parameters.

    This function is the ONLY place skills are registered. No skill
    file calls controller.action() at module level.
    """
    controller = Controller()
    _register_phase_skills(controller, phase, job)
    return controller


def _register_phase_skills(
    controller: Controller,
    phase: Phase,
    job: JobConfig,
) -> None:
    from .tfa import (
        make_get_sms_code,
        make_generate_totp,
        make_wait_for_push,
        make_answer_security_question,
        make_request_human_input,
    )
    from .statements import (
        make_check_already_downloaded,
        make_save_downloaded_pdf,
        make_validate_pdf,
    )
    from .navigation import (
        make_dismiss_modal,
        make_report_observation,
        make_get_account_info,
    )

    # Each make_*() returns a closure bound to `job`, which is then
    # registered on the controller via controller.action(description)(fn).

    if phase == Phase.POST_LOGIN:
        controller.action("Get SMS verification code from Dialpad")(
            make_get_sms_code(job))
        controller.action("Generate TOTP verification code")(
            make_generate_totp(job))
        controller.action("Wait for push notification approval")(
            make_wait_for_push(job))
        controller.action("Answer the security question shown on the page")(
            make_answer_security_question(job))
        controller.action("Request human operator to provide a code or take action")(
            make_request_human_input(job))
        controller.action("Dismiss a popup, modal, cookie banner, or overlay")(
            make_dismiss_modal(job))

    elif phase == Phase.NAV:
        controller.action("Dismiss a popup, modal, cookie banner, or overlay")(
            make_dismiss_modal(job))
        controller.action("Report what you observe on the current page")(
            make_report_observation(job))

    elif phase == Phase.PREPARE:
        controller.action("Get account details for multi-account navigation")(
            make_get_account_info(job))
        controller.action("Dismiss a popup, modal, cookie banner, or overlay")(
            make_dismiss_modal(job))

    elif phase == Phase.DOWNLOAD:
        controller.action("Check if this month's statement has already been downloaded")(
            make_check_already_downloaded(job))
        controller.action("Save the downloaded PDF statement with correct filename")(
            make_save_downloaded_pdf(job))
        controller.action("Verify the downloaded file is a valid PDF")(
            make_validate_pdf(job))
        controller.action("Report what you observe on the current page")(
            make_report_observation(job))
        controller.action("Dismiss a popup, modal, cookie banner, or overlay")(
            make_dismiss_modal(job))

    # Phase.LOGIN and Phase.VALIDATE: no custom actions registered
