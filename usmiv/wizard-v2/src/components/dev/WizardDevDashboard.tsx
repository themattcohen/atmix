/**
 * WizardDevDashboard.tsx -- Dev-only visibility and management tool
 *
 * Never imported from production builds. The entry point (index.ts) wraps
 * this dynamic import behind `if (import.meta.env.DEV)`, and vite.config.ts
 * sets `'import.meta.env.DEV': 'false'` in production, making the entire
 * block dead code that the minifier eliminates.
 *
 * Access: ?wizard-dev=true URL param, or Ctrl+Shift+W keyboard shortcut.
 */

import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { TREATMENTS, QUESTIONS, BUNDLES } from '../../data';
import { validateConfig, type ValidationResult, type ValidationIssue } from '../../engine/validateConfig';
import type { TreatmentId, Treatment, TreatmentCategory } from '../../types/treatment';
import type { QuestionId, Question, SingleQuestion } from '../../types/question';
import type { BundleId, Bundle } from '../../types/bundle';
import '../../styles/dev/dashboard.css';
import '../../styles/dev/editor.css';
import { EditorTab } from './editor/EditorTab';

// ── Types ────────────────────────────────────────────────────────────────────

type DashboardTab = 'tree' | 'coverage' | 'validation' | 'editor';

// A resolved path from start to a terminal (treatment or bundle)
interface WalkPath {
  steps: string[];           // question IDs + option labels interleaved
  terminal: string;          // treatment or bundle ID
  terminalKind: 'treatment' | 'bundle';
}

// ── Path walking utility ─────────────────────────────────────────────────────

/**
 * Walk the question graph from 'start' and collect all complete paths to
 * terminal nodes (recommend values). Returns an array of WalkPath objects.
 * Handles cycle detection to prevent infinite loops.
 */
function collectAllPaths(): WalkPath[] {
  const paths: WalkPath[] = [];

  function walk(
    qid: string,
    currentSteps: string[],
    visitedQuestions: Set<string>,
  ): void {
    if (visitedQuestions.has(qid)) return;  // cycle guard

    const q = QUESTIONS[qid as QuestionId] as Question | undefined;
    if (!q || q.type !== 'single') return;  // symptoms question has no direct paths

    const newVisited = new Set(visitedQuestions);
    newVisited.add(qid);

    for (const opt of (q as SingleQuestion).options) {
      const stepsWithOption = [...currentSteps, qid, opt.label];
      if (opt.recommend) {
        const isBunde = opt.recommend in BUNDLES;
        paths.push({
          steps: stepsWithOption,
          terminal: opt.recommend,
          terminalKind: isBunde ? 'bundle' : 'treatment',
        });
      } else if (opt.next) {
        walk(opt.next, stepsWithOption, newVisited);
      }
    }
  }

  walk('start', [], new Set());
  return paths;
}

/**
 * Find all paths that end at a given terminal ID (treatment or bundle).
 */
function pathsToTerminal(targetId: string, allPaths: WalkPath[]): WalkPath[] {
  return allPaths.filter((p) => p.terminal === targetId);
}

/**
 * Collect the set of reachable terminal IDs from question paths.
 * Bundles are marked as reachable; their primary treatment is also reachable.
 */
function buildReachableSet(): Set<string> {
  const reachable = new Set<string>();
  const allPaths = collectAllPaths();
  for (const p of allPaths) {
    reachable.add(p.terminal);
    if (p.terminalKind === 'bundle') {
      const bundle = BUNDLES[p.terminal as BundleId];
      if (bundle) {
        reachable.add(bundle.primary);
        if (bundle.addOn) reachable.add(bundle.addOn);
      }
    }
  }
  return reachable;
}

// Pre-compute these once at module level (they never change at runtime).
const ALL_PATHS = collectAllPaths();
const REACHABLE_SET = buildReachableSet();

// ── Category display helpers ─────────────────────────────────────────────────

function categoryBadgeClass(cat: TreatmentCategory): string {
  switch (cat) {
    case 'iv':         return 'wdd-cat-badge wdd-cat-badge--iv';
    case 'nad':        return 'wdd-cat-badge wdd-cat-badge--nad';
    case 'weightLoss': return 'wdd-cat-badge wdd-cat-badge--weightloss';
    case 'injection':  return 'wdd-cat-badge wdd-cat-badge--injection';
    case 'lab':        return 'wdd-cat-badge wdd-cat-badge--lab';
  }
}

function formatPrice(t: Treatment): string {
  if (t.priceLabel) return t.priceLabel;
  return `$${t.price}`;
}

// ── Sorted treatments for coverage matrix ────────────────────────────────────

const CATEGORY_ORDER: TreatmentCategory[] = ['iv', 'nad', 'weightLoss', 'injection', 'lab'];

function sortedTreatments(): Treatment[] {
  return Object.values(TREATMENTS).sort((a, b) => {
    const catDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    return b.price - a.price;  // descending price within category
  });
}

// ── TreeView ─────────────────────────────────────────────────────────────────

/**
 * Renders the question graph as nested inline-block columns.
 * Each question is a column (left to right = tree depth).
 * Each option in that column has an edge label + the next node.
 */

interface TreeViewProps {
  selectedTreatment: string | null;
  selectedQuestion: QuestionId | null;
  onSelectTreatment: (id: string | null) => void;
  onSelectQuestion: (id: QuestionId | null) => void;
}

// Shared questions appear in multiple places in the tree.
const SHARED_QUESTIONS: Set<string> = new Set(['myersUpgrade', 'nadDose']);

interface TreeNodeProps {
  qid: string;
  depth: number;
  visitedInBranch: Set<string>;
  selectedTreatment: string | null;
  selectedQuestion: QuestionId | null;
  onSelectTreatment: (id: string | null) => void;
  onSelectQuestion: (id: QuestionId | null) => void;
}

function TreeNode({
  qid,
  depth,
  visitedInBranch,
  selectedTreatment,
  selectedQuestion,
  onSelectTreatment,
  onSelectQuestion,
}: TreeNodeProps): React.ReactElement {
  const q = QUESTIONS[qid as QuestionId] as Question | undefined;
  const isShared = SHARED_QUESTIONS.has(qid) && depth > 0;

  // If this is a shared question that we've already rendered, show a stub.
  // Don't expand it again to avoid infinite recursion.
  const alreadyVisited = visitedInBranch.has(qid);

  const handleClickQuestion = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectTreatment(null);
    onSelectQuestion(
      selectedQuestion === qid ? null : (qid as QuestionId),
    );
  };

  if (!q) {
    return (
      <span className="wdd-q-node" style={{ opacity: 0.5 }}>
        <span className="wdd-q-node-header">{qid}</span>
        <span className="wdd-q-node-title">(unknown question)</span>
      </span>
    );
  }

  // Multi-question (symptoms) -- terminal, shown as a purple leaf
  if (q.type === 'multi') {
    return (
      <span className="wdd-symptoms-leaf">
        <span className="wdd-symptoms-leaf-header">Multi / Scoring</span>
        <span className="wdd-symptoms-leaf-label">{q.title}</span>
      </span>
    );
  }

  const sq = q as SingleQuestion;

  // If we already visited this in the current branch, show a reference stub only
  if (alreadyVisited) {
    return (
      <span
        className="wdd-q-node"
        data-selected={selectedQuestion === qid ? 'true' : 'false'}
        onClick={handleClickQuestion}
        style={{ opacity: 0.7 }}
      >
        <span className="wdd-q-node-header">
          {qid}
          {isShared && <span className="wdd-shared-badge">SHARED</span>}
        </span>
        <span className="wdd-q-node-title">[see earlier] {sq.title}</span>
      </span>
    );
  }

  const newVisited = new Set(visitedInBranch);
  newVisited.add(qid);

  return (
    <span className="wdd-tree-node">
      {/* The question block */}
      <span
        className="wdd-q-node"
        data-selected={selectedQuestion === qid ? 'true' : 'false'}
        onClick={handleClickQuestion}
        style={{ display: 'inline-flex' }}
      >
        <span className="wdd-q-node-header">
          {qid}
          {isShared && <span className="wdd-shared-badge">SHARED</span>}
        </span>
        <span className="wdd-q-node-title">{sq.title}</span>
      </span>

      {/* Options */}
      {sq.options.map((opt, i) => (
        <span key={i} className="wdd-tree-option-row" style={{ display: 'flex', alignItems: 'center' }}>
          <span className="wdd-edge">
            <span className="wdd-edge-label">{opt.label}</span>
            <span className="wdd-edge-arrow"> →</span>
          </span>

          {opt.recommend ? (
            (() => {
              const isBundleId = opt.recommend in BUNDLES;
              if (isBundleId) {
                const bundle = BUNDLES[opt.recommend as BundleId];
                return (
                  <span
                    className="wdd-bundle-leaf"
                    data-selected={selectedTreatment === opt.recommend ? 'true' : 'false'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectQuestion(null);
                      onSelectTreatment(
                        selectedTreatment === opt.recommend ? null : (opt.recommend as string),
                      );
                    }}
                  >
                    <span className="wdd-bundle-leaf-header">Bundle</span>
                    <span className="wdd-bundle-leaf-id">{opt.recommend}</span>
                    {bundle && (
                      <span style={{ fontSize: 9, padding: '2px 8px', color: '#9a3412' }}>
                        {bundle.name}
                      </span>
                    )}
                  </span>
                );
              } else {
                const t = TREATMENTS[opt.recommend as TreatmentId];
                return (
                  <span
                    className="wdd-treatment-leaf"
                    data-selected={selectedTreatment === opt.recommend ? 'true' : 'false'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectQuestion(null);
                      onSelectTreatment(
                        selectedTreatment === opt.recommend ? null : (opt.recommend as string),
                      );
                    }}
                  >
                    <span className="wdd-treatment-leaf-header">Treatment</span>
                    <span className="wdd-treatment-leaf-id">{opt.recommend}</span>
                    {t && (
                      <span style={{ fontSize: 9, padding: '2px 8px', color: '#14532d' }}>
                        {formatPrice(t)}
                      </span>
                    )}
                  </span>
                );
              }
            })()
          ) : opt.next ? (
            <TreeNode
              qid={opt.next}
              depth={depth + 1}
              visitedInBranch={newVisited}
              selectedTreatment={selectedTreatment}
              selectedQuestion={selectedQuestion}
              onSelectTreatment={onSelectTreatment}
              onSelectQuestion={onSelectQuestion}
            />
          ) : (
            <span className="wdd-empty">(no next)</span>
          )}
        </span>
      ))}
    </span>
  );
}

// Side panel for the tree view
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
    const paths = pathsToTerminal(selectedTreatment, ALL_PATHS);

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
          <span className="wdd-detail-val">{primary ? formatPrice(primary) : '?'}</span>
        </div>
        {addOn && (
          <div className="wdd-detail-row">
            <span className="wdd-detail-key">addOn $</span>
            <span className="wdd-detail-val">{formatPrice(addOn)}</span>
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

  const paths = pathsToTerminal(selectedTreatment, ALL_PATHS);
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
        <span className="wdd-detail-val">{formatPrice(t)}</span>
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

function TreeView({ selectedTreatment, selectedQuestion, onSelectTreatment, onSelectQuestion }: TreeViewProps): React.ReactElement {
  return (
    <div className="wdd-layout">
      <div className="wdd-main">
        <div className="wdd-tree">
          <TreeNode
            qid="start"
            depth={0}
            visitedInBranch={new Set()}
            selectedTreatment={selectedTreatment}
            selectedQuestion={selectedQuestion}
            onSelectTreatment={onSelectTreatment}
            onSelectQuestion={onSelectQuestion}
          />
        </div>
      </div>
      <TreeSidePanel selectedTreatment={selectedTreatment} selectedQuestion={selectedQuestion} />
    </div>
  );
}

// ── CoverageMatrix ────────────────────────────────────────────────────────────

interface CoverageMatrixProps {
  onSelectTreatment: (id: TreatmentId | null) => void;
  onSwitchToValidation: (filter: string) => void;
}

function CoverageMatrix({ onSelectTreatment, onSwitchToValidation }: CoverageMatrixProps): React.ReactElement {
  const [selectedRow, setSelectedRow] = useState<TreatmentId | null>(null);
  const treatments = sortedTreatments();

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

  return (
    <div className="wdd-layout">
      <div className="wdd-main">
        <table className="wdd-matrix-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Reachable</th>
              <th>Has whyMatch</th>
              <th>Scoring Weights</th>
              <th>Addon Suggestions</th>
              <th>Acuity ID</th>
              <th>In Bundle</th>
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
                  <td>{formatPrice(t)}</td>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── ValidationView ────────────────────────────────────────────────────────────

interface ValidationViewProps {
  result: ValidationResult;
  filterTreatment: string | null;
}

function ValidationView({ result, filterTreatment }: ValidationViewProps): React.ReactElement {
  const highlightRef = useRef<HTMLDivElement>(null);

  // Scroll to first highlighted item when filter changes
  useEffect(() => {
    if (filterTreatment && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [filterTreatment]);

  const isHighlighted = (issue: ValidationIssue): boolean => {
    if (!filterTreatment) return false;
    return issue.subject.includes(filterTreatment);
  };

  const allIssues = [...result.errors, ...result.warnings];
  const hasFilter = Boolean(filterTreatment);

  // Find first highlighted issue to attach ref
  let firstHighlightedIdx = -1;
  if (hasFilter) {
    firstHighlightedIdx = allIssues.findIndex((i) => isHighlighted(i));
  }

  return (
    <div className="wdd-main" style={{ overflow: 'auto' }}>
      {/* Summary */}
      <div className="wdd-validation-summary">
        {result.isValid ? (
          <div className="wdd-summary-card wdd-summary-card--ok">
            <span className="wdd-count">0</span>
            Errors
          </div>
        ) : (
          <div className="wdd-summary-card wdd-summary-card--error">
            <span className="wdd-count">{result.errors.length}</span>
            Error{result.errors.length !== 1 ? 's' : ''}
          </div>
        )}
        <div className={`wdd-summary-card wdd-summary-card--${result.warnings.length > 0 ? 'warning' : 'ok'}`}>
          <span className="wdd-count">{result.warnings.length}</span>
          Warning{result.warnings.length !== 1 ? 's' : ''}
        </div>
        <div className="wdd-summary-card wdd-summary-card--ok">
          <span className="wdd-count">{Object.keys(TREATMENTS).length}</span>
          Treatments
        </div>
        <div className="wdd-summary-card wdd-summary-card--ok">
          <span className="wdd-count">{Object.keys(QUESTIONS).length}</span>
          Questions
        </div>
        <div className="wdd-summary-card wdd-summary-card--ok">
          <span className="wdd-count">{Object.keys(BUNDLES).length}</span>
          Bundles
        </div>
      </div>

      {hasFilter && (
        <div style={{ marginBottom: 12, padding: '6px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, fontSize: 12, color: '#1d4ed8' }}>
          Filtered to: <strong>{filterTreatment}</strong>
        </div>
      )}

      {allIssues.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#16a34a', fontSize: 14, fontWeight: 700 }}>
          All validation checks passed.
        </div>
      ) : (
        <>
          {/* Errors first */}
          {result.errors.length > 0 && (
            <>
              <div className="wdd-issues-header wdd-issues-header--error">
                Errors ({result.errors.length})
              </div>
              <div className="wdd-issue-list">
                {result.errors.map((issue, i) => {
                  const highlighted = isHighlighted(issue);
                  const isFirst = hasFilter && i === allIssues.findIndex((x) => isHighlighted(x));
                  return (
                    <div
                      key={i}
                      ref={isFirst ? highlightRef : undefined}
                      className="wdd-issue-item wdd-issue-item--error"
                      data-highlighted={highlighted ? 'true' : 'false'}
                    >
                      <span className="wdd-issue-severity wdd-issue-severity--error">ERROR</span>
                      <div>
                        <div className="wdd-issue-subject">{issue.subject}</div>
                        <div className="wdd-issue-field">{issue.field}</div>
                      </div>
                      <div className="wdd-issue-message">{issue.message}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <>
              <div className="wdd-issues-header wdd-issues-header--warning" style={{ marginTop: result.errors.length > 0 ? 20 : 0 }}>
                Warnings ({result.warnings.length})
              </div>
              <div className="wdd-issue-list">
                {result.warnings.map((issue, i) => {
                  const highlighted = isHighlighted(issue);
                  const globalIdx = result.errors.length + i;
                  const isFirst = hasFilter && globalIdx === firstHighlightedIdx;
                  return (
                    <div
                      key={i}
                      ref={isFirst ? highlightRef : undefined}
                      className="wdd-issue-item wdd-issue-item--warning"
                      data-highlighted={highlighted ? 'true' : 'false'}
                    >
                      <span className="wdd-issue-severity wdd-issue-severity--warning">WARN</span>
                      <div>
                        <div className="wdd-issue-subject">{issue.subject}</div>
                        <div className="wdd-issue-field">{issue.field}</div>
                      </div>
                      <div className="wdd-issue-message">{issue.message}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── WizardDevDashboard (root component) ──────────────────────────────────────

export function WizardDevDashboard(): React.ReactElement {
  const [tab, setTab] = useState<DashboardTab>('tree');
  const [selectedTreatment, setSelectedTreatment] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionId | null>(null);
  const [validationFilter, setValidationFilter] = useState<string | null>(null);

  // Called synchronously -- no async concerns, these are static maps
  const validation = validateConfig(TREATMENTS, QUESTIONS, BUNDLES);

  function handleSwitchToValidation(treatmentId: string): void {
    setValidationFilter(treatmentId);
    setTab('validation');
  }

  function handleSelectTreatmentFromMatrix(id: TreatmentId | null): void {
    setSelectedTreatment(id);
    setSelectedQuestion(null);
    setTab('tree');
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
        <button className="wdd-close" onClick={unmountDevDashboard}>
          Close  [Ctrl+Shift+W]
        </button>
      </header>

      <nav className="wdd-tabs">
        <button
          onClick={() => setTab('tree')}
          data-active={tab === 'tree' ? 'true' : 'false'}
        >
          Decision Tree
        </button>
        <button
          onClick={() => setTab('coverage')}
          data-active={tab === 'coverage' ? 'true' : 'false'}
        >
          Coverage Matrix ({Object.keys(TREATMENTS).length} rows)
        </button>
        <button
          onClick={() => { setTab('validation'); setValidationFilter(null); }}
          data-active={tab === 'validation' ? 'true' : 'false'}
        >
          Validation{validation.errors.length > 0 ? ` (${validation.errors.length})` : ''}
        </button>
        <button
          onClick={() => setTab('editor')}
          data-active={tab === 'editor' ? 'true' : 'false'}
        >
          Editor
        </button>
      </nav>

      <div className="wdd-content">
        {tab === 'tree' && (
          <TreeView
            selectedTreatment={selectedTreatment}
            selectedQuestion={selectedQuestion}
            onSelectTreatment={(id) => {
              setSelectedTreatment(id);
              setSelectedQuestion(null);
            }}
            onSelectQuestion={(id) => {
              setSelectedQuestion(id);
              setSelectedTreatment(null);
            }}
          />
        )}
        {tab === 'coverage' && (
          <CoverageMatrix
            onSelectTreatment={handleSelectTreatmentFromMatrix}
            onSwitchToValidation={handleSwitchToValidation}
          />
        )}
        {tab === 'validation' && (
          <ValidationView
            result={validation}
            filterTreatment={validationFilter}
          />
        )}
        {tab === 'editor' && (
          <EditorTab treatments={TREATMENTS} />
        )}
      </div>
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
