/**
 * WizardDevDashboard.tsx -- Dev-only visibility and management tool
 *
 * In the WP-admin context, the PHP admin page injects window.wizardOfIvBootstrap
 * before this script runs. When that global is present the dashboard:
 *   - Uses bootstrap.config as initial state (skips the first remote fetch)
 *   - Authenticates saves with X-WP-Nonce from bootstrap.nonce
 *   - Posts saves to bootstrap.restUrl
 *
 * Legacy fallback (atmix.org / ?wizard-dev=true): when wizardOfIvBootstrap is
 * absent the dashboard falls back to reading from the remote config URL and
 * displays a manual "Save & Publish" button that POSTs with the WP nonce if
 * restUrl is available.
 *
 * Access in WP admin: wp-admin/admin.php?page=wizard-of-iv
 * Access on atmix.org: ?wizard-dev=true URL param, or Ctrl+Shift+W keyboard shortcut.
 */

import React, { useState, useCallback, useRef, useEffect, useTransition } from 'react';
import { createRoot } from 'react-dom/client';
import { TREATMENTS, QUESTIONS, BUNDLES } from '../../data';
import { configUrl } from '../../data/meta';
import { validateConfig, type ValidationResult, type ValidationIssue } from '../../engine/validateConfig';
import type { TreatmentId, Treatment } from '../../types/treatment';
import type { QuestionId, Question } from '../../types/question';
import type { BundleId, Bundle } from '../../types/bundle';
import { computeAllPaths, pathsForTreatment, reachableTreatmentIds, type ResolvedPath } from '../../utils/pathResolver';
import { getFieldExplanation } from '../../utils/issueMapper';
import {
  categoryBadgeClass,
  sortedTreatments,
  formatTreatmentPrice,
} from '../../utils/dashboardHelpers';
import '../../styles/dev/dashboard.css';
import '../../styles/dev/editor.css';
import { EditorTab } from './editor/EditorTab';
import { FlowCanvas } from './FlowCanvas';
import { PathsTab } from './PathsTab';
import { OnboardingTour } from './OnboardingTour';

// ── Types ────────────────────────────────────────────────────────────────────

type DashboardTab = 'editor' | 'paths' | 'tree' | 'coverage' | 'validation';

// WizardOfIvBootstrap and the window.wizardOfIvBootstrap augmentation are
// declared in src/types/global.d.ts and available throughout the project.

// Pre-compute these once at module level (they never change at runtime).
const ALL_PATHS: ResolvedPath[] = computeAllPaths(QUESTIONS, BUNDLES);
const REACHABLE_SET: Set<string> = reachableTreatmentIds(ALL_PATHS);

// ── Flow tab side panel ───────────────────────────────────────────────────────

interface TreeSidePanelProps {
  selectedTreatment: string | null;
  selectedQuestion: QuestionId | null;
}

function TreeSidePanel({ selectedTreatment, selectedQuestion }: TreeSidePanelProps): React.ReactElement {
  if (!selectedTreatment && !selectedQuestion) {
    return (
      <div className="wdd-sidebar wdd-sidebar--empty">
        Click a treatment, bundle, or question node to see details
      </div>
    );
  }

  if (selectedQuestion) {
    const q = QUESTIONS[selectedQuestion] as Question | undefined;
    if (!q) return <div className="wdd-sidebar"><span className="wdd-empty">Unknown question</span></div>;
    return (
      <div className="wdd-sidebar">
        <div className="wdd-detail-id">{selectedQuestion}</div>
        <div className="wdd-detail-name">{q.title}</div>
        {q.subtitle && <div className="wdd-detail-text">{q.subtitle}</div>}
        <div className="wdd-section-title">Options ({q.options.length})</div>
        {q.options.map((opt, i) => (
          <div key={i} className="wdd-detail-row">
            <span className="wdd-detail-key">[{i}]</span>
            <span className="wdd-detail-val" style={{ textAlign: 'left', fontFamily: 'inherit' }}>
              {opt.label}
              {'recommend' in opt && opt.recommend && (
                <span style={{ display: 'block', fontSize: 10, color: '#16a34a', fontFamily: 'ui-monospace, monospace' }}>
                  recommend: {opt.recommend}
                </span>
              )}
              {'next' in opt && opt.next && (
                <span style={{ display: 'block', fontSize: 10, color: '#3b82f6', fontFamily: 'ui-monospace, monospace' }}>
                  next: {opt.next}
                </span>
              )}
            </span>
          </div>
        ))}
        {/* Count paths through this question */}
        {(() => {
          const count = ALL_PATHS.filter((p) => p.steps.includes(selectedQuestion)).length;
          return (
            <div className="wdd-section-title" style={{ marginTop: 16 }}>
              {count} path{count !== 1 ? 's' : ''} flow through this question
            </div>
          );
        })()}
      </div>
    );
  }

  // Treatment or bundle selected
  if (!selectedTreatment) return <></>;

  const isBundleId = selectedTreatment in BUNDLES;

  if (isBundleId) {
    const bundle = BUNDLES[selectedTreatment as BundleId] as Bundle;
    const primary = TREATMENTS[bundle.primary];
    const addOn = bundle.addOn ? TREATMENTS[bundle.addOn] : null;
    const paths = ALL_PATHS.filter((p) => p.terminal === selectedTreatment);

    return (
      <div className="wdd-sidebar">
        <div className="wdd-detail-id">bundle: {selectedTreatment}</div>
        <div className="wdd-detail-name">{bundle.name}</div>
        <div className="wdd-detail-row">
          <span className="wdd-detail-key">primary</span>
          <span className="wdd-detail-val">{bundle.primary}</span>
        </div>
        {bundle.addOn && (
          <div className="wdd-detail-row">
            <span className="wdd-detail-key">addOn</span>
            <span className="wdd-detail-val">{bundle.addOn}</span>
          </div>
        )}
        <div className="wdd-detail-row">
          <span className="wdd-detail-key">acuityId</span>
          <span className="wdd-detail-val">{bundle.acuityTypeId || <span style={{ color: '#dc2626' }}>MISSING</span>}</span>
        </div>
        <div className="wdd-detail-row">
          <span className="wdd-detail-key">primary $</span>
          <span className="wdd-detail-val">{primary ? formatTreatmentPrice(primary) : '?'}</span>
        </div>
        {addOn && (
          <div className="wdd-detail-row">
            <span className="wdd-detail-key">addOn $</span>
            <span className="wdd-detail-val">{formatTreatmentPrice(addOn)}</span>
          </div>
        )}
        <div className="wdd-section-title">whyMatch</div>
        <div className="wdd-detail-text">{bundle.whyMatch || <span className="wdd-empty">(empty)</span>}</div>
        <div className="wdd-section-title">Paths ({paths.length})</div>
        <div className="wdd-path-list">
          {paths.length === 0 ? (
            <span className="wdd-empty">No question paths reach this bundle</span>
          ) : (
            paths.map((p, i) => (
              <div key={i} className="wdd-path-item">
                {p.steps.filter((_, idx) => idx % 2 === 0).join(' → ')}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  const t = TREATMENTS[selectedTreatment as TreatmentId] as Treatment | undefined;
  if (!t) return <div className="wdd-sidebar"><span className="wdd-empty">Unknown treatment: {selectedTreatment}</span></div>;

  const paths = pathsForTreatment(selectedTreatment, ALL_PATHS);
  const weightEntries = Object.entries(t.scoringWeights).filter(([, v]) => (v ?? 0) > 0);

  return (
    <div className="wdd-sidebar">
      <div className="wdd-detail-id">{selectedTreatment}</div>
      <div className="wdd-detail-name">{t.name}</div>
      <div className="wdd-detail-row">
        <span className="wdd-detail-key">category</span>
        <span className="wdd-detail-val">{t.category}</span>
      </div>
      <div className="wdd-detail-row">
        <span className="wdd-detail-key">price</span>
        <span className="wdd-detail-val">{formatTreatmentPrice(t)}</span>
      </div>
      <div className="wdd-detail-row">
        <span className="wdd-detail-key">acuityId</span>
        <span className="wdd-detail-val" style={{ color: t.acuityTypeId ? undefined : '#dc2626' }}>
          {t.acuityTypeId || 'MISSING'}
        </span>
      </div>
      <div className="wdd-detail-row">
        <span className="wdd-detail-key">duration</span>
        <span className="wdd-detail-val">{t.duration}</span>
      </div>
      <div className="wdd-section-title">whyMatch</div>
      <div className="wdd-detail-text">{t.whyMatch || <span className="wdd-empty">(empty)</span>}</div>
      <div className="wdd-section-title">addonSuggestions</div>
      <div className="wdd-tag-list">
        {t.addonSuggestions.length === 0 ? (
          <span className="wdd-empty">(none)</span>
        ) : (
          t.addonSuggestions.map((a) => (
            <span key={a} className="wdd-addon-tag">{a}</span>
          ))
        )}
      </div>
      <div className="wdd-section-title">scoringWeights ({weightEntries.length})</div>
      {weightEntries.length === 0 ? (
        <span className="wdd-empty">(none -- not reachable via symptom path)</span>
      ) : (
        <table className="wdd-weight-table">
          <thead>
            <tr>
              <th>Symptom</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {weightEntries.map(([symptom, weight]) => (
              <tr key={symptom}>
                <td>{symptom}</td>
                <td style={{ fontWeight: 700 }}>{weight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="wdd-section-title">Paths ({paths.length})</div>
      <div className="wdd-path-list">
        {paths.length === 0 ? (
          <span className="wdd-empty">No direct question paths (scoring only or unreachable)</span>
        ) : (
          paths.map((p, i) => (
            <div key={i} className="wdd-path-item">
              {p.steps.filter((_, idx) => idx % 2 === 0).join(' → ')}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── CoverageMatrix ────────────────────────────────────────────────────────────

interface CoverageMatrixProps {
  onSelectTreatment: (id: TreatmentId | null) => void;
  onSwitchToValidation: (filter: string) => void;
  onFixInEditor: (treatmentId: string) => void;
}

function CoverageMatrix({ onSelectTreatment, onSwitchToValidation, onFixInEditor }: CoverageMatrixProps): React.ReactElement {
  const [selectedRow, setSelectedRow] = useState<TreatmentId | null>(null);
  const treatments = sortedTreatments(TREATMENTS);

  // For each treatment, determine which bundles include it
  const treatmentBundleMap = new Map<TreatmentId, string[]>();
  for (const [bid, bundle] of Object.entries(BUNDLES) as [BundleId, Bundle][]) {
    const addToMap = (tid: TreatmentId) => {
      const existing = treatmentBundleMap.get(tid) ?? [];
      existing.push(bid);
      treatmentBundleMap.set(tid, existing);
    };
    addToMap(bundle.primary);
    if (bundle.addOn) addToMap(bundle.addOn);
  }

  function handleRowClick(tid: TreatmentId) {
    const next = selectedRow === tid ? null : tid;
    setSelectedRow(next);
    onSelectTreatment(next);
  }

  function handleWarningCellClick(e: React.MouseEvent, tid: TreatmentId) {
    e.stopPropagation();
    onSwitchToValidation(tid);
  }

  // "Fully configured" = reachable AND has whyMatch AND has acuityTypeId > 0
  const fullyConfiguredCount = treatments.filter((t) => {
    const isReachable = REACHABLE_SET.has(t.id) || Object.keys(t.scoringWeights).length > 0;
    return isReachable && t.whyMatch.trim().length > 0 && t.acuityTypeId > 0;
  }).length;

  return (
    <div className="wdd-layout">
      <div className="wdd-main" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Summary line */}
        <div className="wdd-matrix-summary">
          <span>
            <strong>{fullyConfiguredCount} of {treatments.length}</strong> treatments fully configured
          </span>
          <span className="wdd-legend">
            <span className="wdd-legend-item wdd-legend-ok">OK</span>
            <span className="wdd-legend-item wdd-legend-warn">Warning</span>
            <span className="wdd-legend-item wdd-legend-error">Error</span>
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
          <table className="wdd-matrix-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th title="Can a user reach this treatment through the wizard? If No, this treatment can never be booked.">Reachable</th>
                <th title="The clinical explanation shown on the result screen. Empty means a blank explanation area.">Has whyMatch</th>
                <th title="How many symptoms score for this treatment in the 'help me decide' path. 0 means it's invisible to symptom matching.">Scoring Weights</th>
                <th title="Injection add-ons suggested on the result screen. 0 means no upsell opportunity.">Addon Suggestions</th>
                <th title="Booking system appointment type ID. Required for booking to work.">Acuity ID</th>
                <th title="Which bundle package includes this treatment.">In Bundle</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {treatments.map((t) => {
                const isReachable = REACHABLE_SET.has(t.id) || Object.keys(t.scoringWeights).length > 0;
                const hasWhyMatch = t.whyMatch.trim().length > 0;
                const weightCount = Object.values(t.scoringWeights).filter((v) => (v ?? 0) > 0).length;
                const hasAddons = t.addonSuggestions.length > 0;
                const hasAcuity = t.acuityTypeId > 0;
                const bundles = treatmentBundleMap.get(t.id) ?? [];

                const hasError = !isReachable || !hasAcuity;
                const hasWarn = !hasWhyMatch || !hasAddons;

                return (
                  <tr
                    key={t.id}
                    data-selected={selectedRow === t.id ? 'true' : 'false'}
                    data-has-error={hasError ? 'true' : 'false'}
                    data-has-warning={!hasError && hasWarn ? 'true' : 'false'}
                    onClick={() => handleRowClick(t.id)}
                  >
                    <td>
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{t.id}</span>
                    </td>
                    <td>{t.name}</td>
                    <td>
                      <span className={categoryBadgeClass(t.category)}>
                        {t.category}
                      </span>
                    </td>
                    <td>{formatTreatmentPrice(t)}</td>
                    <td>
                      {isReachable ? (
                        <span className="wdd-cell-ok">Yes</span>
                      ) : (
                        <span
                          className="wdd-cell-error"
                          onClick={(e) => handleWarningCellClick(e, t.id)}
                          title="Click to see in Validation tab"
                        >
                          No
                        </span>
                      )}
                    </td>
                    <td>
                      {hasWhyMatch ? (
                        <span className="wdd-cell-ok">Yes</span>
                      ) : (
                        <span
                          className="wdd-cell-warn"
                          onClick={(e) => handleWarningCellClick(e, t.id)}
                          title="Click to see in Validation tab"
                        >
                          No
                        </span>
                      )}
                    </td>
                    <td>
                      {weightCount > 0 ? (
                        <span className="wdd-cell-ok">{weightCount}</span>
                      ) : (
                        <span className="wdd-cell-na">0</span>
                      )}
                    </td>
                    <td>
                      {hasAddons ? (
                        <span className="wdd-cell-ok">{t.addonSuggestions.length}</span>
                      ) : (
                        <span
                          className="wdd-cell-warn"
                          onClick={(e) => handleWarningCellClick(e, t.id)}
                          title="Click to see in Validation tab"
                        >
                          0
                        </span>
                      )}
                    </td>
                    <td>
                      {hasAcuity ? (
                        <span className="wdd-cell-ok">{t.acuityTypeId}</span>
                      ) : (
                        <span
                          className="wdd-cell-error"
                          onClick={(e) => handleWarningCellClick(e, t.id)}
                          title="Click to see in Validation tab"
                        >
                          MISSING
                        </span>
                      )}
                    </td>
                    <td>
                      {bundles.length > 0 ? (
                        <div className="wdd-tag-list">
                          {bundles.map((bid) => (
                            <span key={bid} className="wdd-addon-tag">{bid}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="wdd-cell-na">--</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="wdd-matrix-edit"
                        onClick={(e) => { e.stopPropagation(); onFixInEditor(t.id); }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * Extract the treatment ID from an issue subject string like "treatment:hangover"
 * Returns null for non-treatment subjects (e.g. "question:...", "bundle:...").
 */
function treatmentIdFromSubject(subject: string): string | null {
  const match = subject.match(/^treatment:(.+)$/);
  return match ? match[1] : null;
}

// ── ValidationView (Health) ────────────────────────────────────────────────────

interface ValidationViewProps {
  result: ValidationResult;
  filterTreatment: string | null;
  onFixInEditor: (treatmentId: string) => void;
}

function ValidationView({ result, filterTreatment, onFixInEditor }: ValidationViewProps): React.ReactElement {
  const highlightRef = useRef<HTMLDivElement>(null);

  // Scroll to first highlighted item when filter changes
  useEffect(() => {
    if (filterTreatment && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [filterTreatment]);

  const allIssues = [...result.errors, ...result.warnings];
  const hasFilter = Boolean(filterTreatment);
  // Bug 4 fix: exact match instead of substring match
  const visibleIssues = hasFilter
    ? allIssues.filter((i) =>
        i.subject === `treatment:${filterTreatment!}` ||
        i.subject.startsWith(`treatment:${filterTreatment!}:`)
      )
    : allIssues;

  // Health status
  const healthStatus = result.errors.length > 0
    ? 'critical'
    : result.warnings.length > 0
      ? 'warning'
      : 'good';

  const healthLabel = healthStatus === 'critical' ? 'CRITICAL'
    : healthStatus === 'warning' ? 'NEEDS ATTENTION'
    : 'GOOD';

  const renderIssueCard = (issue: ValidationIssue, index: number) => {
    // When filtered, index 0 is always the first match
    const isFirst = hasFilter && index === 0;
    const tid = treatmentIdFromSubject(issue.subject);
    const treatment = tid ? TREATMENTS[tid as TreatmentId] : null;
    const displaySubject = treatment ? treatment.name : issue.subject;
    const explanation = getFieldExplanation(issue.field);

    return (
      <div
        key={`${issue.subject}-${issue.field}-${index}`}
        ref={isFirst ? highlightRef : undefined}
        className="wdd-issue-card"
      >
        <div className="wdd-issue-card-header">
          <span className={`wdd-issue-severity wdd-issue-severity--${issue.severity === 'error' ? 'error' : 'warning'}`}>
            {issue.severity === 'error' ? 'ERROR' : 'WARN'}
          </span>
          <span className="wdd-issue-card-subject">{displaySubject}</span>
          <span className="wdd-issue-card-field">{issue.field}</span>
        </div>
        <div className="wdd-issue-card-body">
          <div>{issue.message}</div>
          {explanation && (
            <>
              <div className="wdd-issue-card-why">Why it matters: {explanation.why}</div>
              <div className="wdd-issue-card-fix">How to fix: {explanation.fix}</div>
            </>
          )}
          {tid && (
            <button
              className="wdd-fix-btn"
              onClick={() => onFixInEditor(tid)}
            >
              Fix in Editor
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="wdd-main" style={{ overflow: 'auto' }}>
      {/* Health banner */}
      <div className={`wdd-health-banner wdd-health-banner--${healthStatus}`}>
        <div className="wdd-health-score">Config Health: {healthLabel}</div>
        <div className="wdd-health-stats">
          {result.errors.length} error{result.errors.length !== 1 ? 's' : ''} &middot;{' '}
          {result.warnings.length} warning{result.warnings.length !== 1 ? 's' : ''} &middot;{' '}
          {Object.keys(TREATMENTS).length} treatments
        </div>
      </div>

      {hasFilter && (
        <div style={{ marginBottom: 12, padding: '6px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, fontSize: 12, color: '#1d4ed8' }}>
          Filtered to: <strong>{filterTreatment}</strong>
        </div>
      )}

      {visibleIssues.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#16a34a', fontSize: 14, fontWeight: 700 }}>
          {hasFilter ? 'No issues found for this treatment.' : 'All validation checks passed.'}
        </div>
      ) : (
        <div className="wdd-issue-list">
          {visibleIssues.map((issue, i) => renderIssueCard(issue, i))}
        </div>
      )}
    </div>
  );
}

// ── WizardDevDashboard (root component) ──────────────────────────────────────

export function WizardDevDashboard(): React.ReactElement {
  const [tab, setTab] = useState<DashboardTab>('editor');
  const [selectedTreatment, setSelectedTreatment] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionId | null>(null);
  const [validationFilter, setValidationFilter] = useState<string | null>(null);
  // pendingEditId: when "Fix in Editor" is clicked, we store the target ID here
  // and switch to the editor tab. EditorTab reads it via initialSelectedId.
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);

  // Tour state -- auto-open on first visit
  const [tourOpen, setTourOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!localStorage.getItem('wizard-admin-tour-seen')) {
      setTourOpen(true);
    }
  }, []);

  function handleTourSwitchTab(newTab: string): void {
    setTab(newTab as DashboardTab);
  }

  function handleTourClose(): void {
    setTourOpen(false);
  }

  // Lifted validation state: updated by EditorTab whenever drafts change.
  // Initialized from compiled data; updated live as the editor modifies drafts.
  const [validation, setValidation] = useState<ValidationResult>(
    () => validateConfig(TREATMENTS, QUESTIONS, BUNDLES),
  );

  const handleValidationChange = useCallback((result: ValidationResult) => {
    setValidation(result);
  }, []);

  // ── Save & Publish (WP REST or legacy) ────────────────────────────────────

  type SaveStatus = 'idle' | 'saving' | 'success' | 'error';
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [, startSaveTransition] = useTransition();

  /**
   * Resolve the REST endpoint URL and nonce from whichever source is available:
   *   1. window.wizardOfIvBootstrap (WP admin context, injected by PHP)
   *   2. configUrl() (same-origin WP REST, nonce-less -- save will be rejected
   *      by WP unless user happens to have a wpApiSettings.nonce in scope)
   *
   * Returns { restUrl, nonce } or null if neither source is usable.
   */
  function resolveSaveTarget(): { restUrl: string; nonce: string | null } | null {
    if (typeof window !== 'undefined' && window.wizardOfIvBootstrap) {
      const bootstrap = window.wizardOfIvBootstrap!;
      return { restUrl: bootstrap.restUrl, nonce: bootstrap.nonce };
    }
    const url = configUrl();
    if (url) return { restUrl: url, nonce: null };
    return null;
  }

  async function handleSaveAndPublish(): Promise<void> {
    const target = resolveSaveTarget();
    if (!target) {
      setSaveStatus('error');
      setSaveMessage('No REST endpoint available. Cannot save.');
      return;
    }

    setSaveStatus('saving');
    setSaveMessage('');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (target.nonce) {
        headers['X-WP-Nonce'] = target.nonce;
      }

      // Build the config payload from current runtime data
      const payload = {
        treatments: TREATMENTS,
        bundles: BUNDLES,
        questions: QUESTIONS,
      };

      const res = await fetch(target.restUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        startSaveTransition(() => {
          setSaveStatus('success');
          setSaveMessage('Saved successfully.');
        });
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        const text = await res.text().catch(() => '');
        setSaveStatus('error');
        setSaveMessage(`Save failed: ${res.status} ${res.statusText}${text ? ' — ' + text.slice(0, 120) : ''}`);
      }
    } catch (err: unknown) {
      setSaveStatus('error');
      setSaveMessage(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const isBootstrapContext = typeof window !== 'undefined' &&
    !!window.wizardOfIvBootstrap;

  function handleSwitchToValidation(treatmentId: string): void {
    setValidationFilter(treatmentId);
    setTab('validation');
  }

  function handleSelectTreatmentFromMatrix(id: TreatmentId | null): void {
    setSelectedTreatment(id);
    setSelectedQuestion(null);
    setTab('tree');
  }

  function handleFixInEditor(treatmentId: string): void {
    // Clear and re-set to force re-render even if same treatment is already selected.
    // This ensures EditorTab scrolls the form into view on repeat clicks.
    setPendingEditId(null);
    setTimeout(() => setPendingEditId(treatmentId), 0);
    setTab('editor');
  }

  return (
    <div className="wdd-overlay">
      <header className="wdd-header">
        <h1>Wizard Dev Dashboard</h1>
        <span className={`wdd-badge ${validation.errors.length > 0 ? 'wdd-badge--error' : 'wdd-badge--ok'}`}>
          {validation.errors.length} error{validation.errors.length !== 1 ? 's' : ''}
        </span>
        <span className={`wdd-badge ${validation.warnings.length > 0 ? 'wdd-badge--warning' : 'wdd-badge--ok'}`}>
          {validation.warnings.length} warning{validation.warnings.length !== 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>
          {Object.keys(TREATMENTS).length} treatments &middot;{' '}
          {Object.keys(QUESTIONS).length} questions &middot;{' '}
          {Object.keys(BUNDLES).length} bundles &middot;{' '}
          {ALL_PATHS.length} paths
        </span>
        {/* Save & Publish: posts current config to WP REST endpoint */}
        <button
          className={`wdd-save-btn wdd-save-btn--${saveStatus}`}
          onClick={() => { void handleSaveAndPublish(); }}
          disabled={saveStatus === 'saving'}
          title={isBootstrapContext
            ? 'Save config to WordPress (WP nonce auth)'
            : 'Save config to WP REST endpoint (same-origin)'}
          style={{ marginLeft: 'auto' }}
        >
          {saveStatus === 'saving' ? 'Saving...' : 'Save & Publish'}
        </button>
        {saveMessage && (
          <span
            className={`wdd-save-msg wdd-save-msg--${saveStatus}`}
            style={{ fontSize: 11, marginLeft: 8 }}
          >
            {saveMessage}
          </span>
        )}
        <button
          className="wdd-help-btn"
          onClick={() => setTourOpen(true)}
          title="Open onboarding tour"
          aria-label="Open onboarding tour"
        >
          ?
        </button>
        {!isBootstrapContext && (
          <button className="wdd-close" onClick={unmountDevDashboard}>
            Close  [Ctrl+Shift+W]
          </button>
        )}
      </header>

      <nav className="wdd-tabs">
        <button
          onClick={() => setTab('editor')}
          data-active={tab === 'editor' ? 'true' : 'false'}
          data-tour="editor-tab"
        >
          Editor
        </button>
        <button
          onClick={() => setTab('paths')}
          data-active={tab === 'paths' ? 'true' : 'false'}
          data-tour="paths-tab"
        >
          Paths
        </button>
        <button
          onClick={() => setTab('tree')}
          data-active={tab === 'tree' ? 'true' : 'false'}
          data-tour="flow-tab"
        >
          Flow
        </button>
        <button
          onClick={() => setTab('coverage')}
          data-active={tab === 'coverage' ? 'true' : 'false'}
          data-tour="coverage-tab"
        >
          Coverage
        </button>
        <button
          onClick={() => { setTab('validation'); setValidationFilter(null); }}
          data-active={tab === 'validation' ? 'true' : 'false'}
          data-tour="health-tab"
        >
          Health{validation.errors.length > 0 ? ` (${validation.errors.length})` : ''}
        </button>
      </nav>

      <div className="wdd-content" data-tour="content-area">
        {tab === 'editor' && (
          <EditorTab
            treatments={TREATMENTS}
            allPaths={ALL_PATHS}
            initialSelectedId={pendingEditId}
            onValidationChange={handleValidationChange}
          />
        )}
        {tab === 'paths' && (
          <PathsTab
            allPaths={ALL_PATHS}
            onFixInEditor={handleFixInEditor}
          />
        )}
        {tab === 'tree' && (
          <div className="wdd-layout">
            <FlowCanvas
              questions={QUESTIONS}
              treatments={TREATMENTS}
              bundles={BUNDLES}
              onSelectNode={(id, kind) => {
                if (id === null || kind === null) {
                  // Background click: clear side panel
                  setSelectedTreatment(null);
                  setSelectedQuestion(null);
                } else if (kind === 'treatment' || kind === 'bundle') {
                  setSelectedTreatment(id);
                  setSelectedQuestion(null);
                } else {
                  setSelectedQuestion(id as QuestionId);
                  setSelectedTreatment(null);
                }
              }}
            />
            <TreeSidePanel
              selectedTreatment={selectedTreatment}
              selectedQuestion={selectedQuestion}
            />
          </div>
        )}
        {tab === 'coverage' && (
          <CoverageMatrix
            onSelectTreatment={handleSelectTreatmentFromMatrix}
            onSwitchToValidation={handleSwitchToValidation}
            onFixInEditor={handleFixInEditor}
          />
        )}
        {tab === 'validation' && (
          <ValidationView
            result={validation}
            filterTreatment={validationFilter}
            onFixInEditor={handleFixInEditor}
          />
        )}
      </div>

      <OnboardingTour
        isOpen={tourOpen}
        onClose={handleTourClose}
        onSwitchTab={handleTourSwitchTab}
      />
    </div>
  );
}

// ── Mount / unmount ───────────────────────────────────────────────────────────

let dashboardRoot: ReturnType<typeof createRoot> | null = null;

export function mountDevDashboard(): void {
  if (dashboardRoot) return;  // idempotent -- already mounted
  const host = document.createElement('div');
  host.id = 'wdd-root';
  document.body.appendChild(host);
  dashboardRoot = createRoot(host);
  dashboardRoot.render(<WizardDevDashboard />);
}

export function unmountDevDashboard(): void {
  dashboardRoot?.unmount();
  document.getElementById('wdd-root')?.remove();
  dashboardRoot = null;
}
