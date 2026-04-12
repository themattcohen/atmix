/**
 * PathsTab.tsx -- "Paths" tab for the Wizard Dev Dashboard.
 *
 * Three sub-views:
 *   A. All Paths   -- every complete user journey as a breadcrumb chain
 *   B. By Treatment -- select a treatment to see all paths that reach it
 *   C. Orphans      -- treatments with zero paths (unreachable via wizard)
 */

import React, { useState, useMemo } from 'react';
import { TREATMENTS, BUNDLES } from '../../data';
import type { TreatmentCategory, TreatmentId, Treatment } from '../../types/treatment';
import type { BundleId, Bundle } from '../../types/bundle';
import { pathsForTreatment, orphanedTreatments, type ResolvedPath } from '../../utils/pathResolver';

// ── Types ─────────────────────────────────────────────────────────────────────

type SubView = 'all' | 'byTreatment' | 'orphans';

// ── Props ─────────────────────────────────────────────────────────────────────

interface PathsTabProps {
  allPaths: ResolvedPath[];
  onFixInEditor: (treatmentId: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_ORDER: TreatmentCategory[] = ['iv', 'nad', 'weightLoss', 'injection', 'lab'];

function terminalCategoryClass(terminal: string): string {
  const t = TREATMENTS[terminal as TreatmentId] as Treatment | undefined;
  if (t) {
    switch (t.category) {
      case 'iv':         return 'wdd-path-terminal wdd-path-terminal--iv';
      case 'nad':        return 'wdd-path-terminal wdd-path-terminal--nad';
      case 'weightLoss': return 'wdd-path-terminal wdd-path-terminal--weightLoss';
      case 'injection':  return 'wdd-path-terminal wdd-path-terminal--injection';
      case 'lab':        return 'wdd-path-terminal wdd-path-terminal--lab';
    }
  }
  // Bundle -- use IV teal as default
  return 'wdd-path-terminal wdd-path-terminal--iv';
}

function terminalCategory(terminal: string): TreatmentCategory | null {
  const t = TREATMENTS[terminal as TreatmentId] as Treatment | undefined;
  return t ? t.category : null;
}

function formatPrice(terminal: string): string {
  const t = TREATMENTS[terminal as TreatmentId] as Treatment | undefined;
  if (t) return t.priceLabel ? t.priceLabel : `$${t.price}`;
  const b = BUNDLES[terminal as BundleId] as Bundle | undefined;
  if (b) {
    const primary = TREATMENTS[b.primary];
    return primary ? `$${primary.price}+` : '';
  }
  return '';
}

function terminalDisplayName(terminal: string): string {
  const t = TREATMENTS[terminal as TreatmentId] as Treatment | undefined;
  if (t) return t.name;
  const b = BUNDLES[terminal as BundleId] as Bundle | undefined;
  if (b) return b.name;
  return terminal;
}

/** Option labels are the even-indexed elements (qId, label, qId, label, ...) */
function optionLabels(path: ResolvedPath): string[] {
  return path.steps.filter((_, i) => i % 2 === 1);
}

function sortedTreatments(): Treatment[] {
  return Object.values(TREATMENTS).sort((a, b) => {
    const catDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    return a.name.localeCompare(b.name);
  });
}

function categoryLabel(cat: TreatmentCategory): string {
  switch (cat) {
    case 'iv':         return 'IV';
    case 'nad':        return 'NAD';
    case 'weightLoss': return 'Weight Loss';
    case 'injection':  return 'Injection';
    case 'lab':        return 'Lab';
  }
}

function categoryBadgeClass(cat: TreatmentCategory): string {
  switch (cat) {
    case 'iv':         return 'wdd-cat-badge wdd-cat-badge--iv';
    case 'nad':        return 'wdd-cat-badge wdd-cat-badge--nad';
    case 'weightLoss': return 'wdd-cat-badge wdd-cat-badge--weightloss';
    case 'injection':  return 'wdd-cat-badge wdd-cat-badge--injection';
    case 'lab':        return 'wdd-cat-badge wdd-cat-badge--lab';
  }
}

// ── PathBreadcrumb (shared renderer) ─────────────────────────────────────────

interface PathBreadcrumbProps {
  path: ResolvedPath;
}

function PathBreadcrumb({ path }: PathBreadcrumbProps): React.ReactElement {
  const labels = optionLabels(path);
  const termClass = terminalCategoryClass(path.terminal);
  const price = formatPrice(path.terminal);
  const name = terminalDisplayName(path.terminal);

  return (
    <div className="wdd-path-row">
      {labels.map((label, i) => (
        <React.Fragment key={i}>
          <span className="wdd-path-step">{label}</span>
          <span className="wdd-path-arrow">&gt;</span>
        </React.Fragment>
      ))}
      <span className={termClass}>{name}</span>
      {price && <span className="wdd-path-price">{price}</span>}
    </div>
  );
}

// ── Sub-view A: All Paths ─────────────────────────────────────────────────────

interface AllPathsViewProps {
  allPaths: ResolvedPath[];
}

function AllPathsView({ allPaths }: AllPathsViewProps): React.ReactElement {
  const [search, setSearch] = useState('');

  const sortedPaths = useMemo(() => {
    return [...allPaths].sort((a, b) => {
      const catA = terminalCategory(a.terminal);
      const catB = terminalCategory(b.terminal);
      const catDiff = CATEGORY_ORDER.indexOf(catA ?? 'iv') - CATEGORY_ORDER.indexOf(catB ?? 'iv');
      if (catDiff !== 0) return catDiff;
      return terminalDisplayName(a.terminal).localeCompare(terminalDisplayName(b.terminal));
    });
  }, [allPaths]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sortedPaths;
    const q = search.toLowerCase();
    return sortedPaths.filter((p) => {
      if (terminalDisplayName(p.terminal).toLowerCase().includes(q)) return true;
      return optionLabels(p).some((label) => label.toLowerCase().includes(q));
    });
  }, [sortedPaths, search]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Filter by treatment name or option text..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '6px 10px',
            border: '1px solid var(--wdd-border)',
            borderRadius: 4,
            fontSize: 13,
            width: 320,
            fontFamily: 'inherit',
            color: 'var(--wdd-text-primary)',
          }}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            style={{
              padding: '4px 10px',
              background: 'none',
              border: '1px solid var(--wdd-border)',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: 'var(--wdd-text-secondary)',
            }}
          >
            Clear
          </button>
        )}
      </div>
      <div className="wdd-path-count">
        {filtered.length} {filtered.length === allPaths.length ? `path${allPaths.length !== 1 ? 's' : ''}` : `of ${allPaths.length} paths`}
      </div>
      {filtered.length === 0 ? (
        <div className="wdd-paths-empty">No paths match your search.</div>
      ) : (
        <div>
          {filtered.map((p, i) => (
            <PathBreadcrumb key={i} path={p} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sub-view B: By Treatment ──────────────────────────────────────────────────

interface ByTreatmentViewProps {
  allPaths: ResolvedPath[];
  onFixInEditor: (treatmentId: string) => void;
}

function ByTreatmentView({ allPaths, onFixInEditor }: ByTreatmentViewProps): React.ReactElement {
  const [selected, setSelected] = useState<string | null>(null);

  const treatments = useMemo(() => sortedTreatments(), []);

  const pathsByTreatment = useMemo(() => {
    const map = new Map<string, ResolvedPath[]>();
    for (const t of sortedTreatments()) {
      map.set(t.id, pathsForTreatment(t.id, allPaths));
    }
    return map;
  }, [allPaths]);

  const selectedPaths = selected ? (pathsByTreatment.get(selected) ?? []) : [];

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', minHeight: 0 }}>
      {/* Left: treatment list */}
      <div
        style={{
          width: 300,
          flexShrink: 0,
          borderRight: '1px solid var(--wdd-border)',
          overflowY: 'auto',
        }}
      >
        {treatments.map((t) => {
          const count = (pathsByTreatment.get(t.id) ?? []).length;
          const isSelected = selected === t.id;
          return (
            <div
              key={t.id}
              onClick={() => setSelected(isSelected ? null : t.id)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--wdd-border)',
                background: isSelected ? 'var(--wdd-bg-muted)' : 'var(--wdd-bg-surface)',
                borderLeft: isSelected ? '3px solid var(--wdd-accent)' : '3px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--wdd-text-primary)' }}>{t.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span className={categoryBadgeClass(t.category)} style={{ fontSize: 10 }}>
                      {categoryLabel(t.category)}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--wdd-text-secondary)' }}>
                      {t.priceLabel ?? `$${t.price}`}
                    </span>
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {count === 0 ? (
                    <span className="wdd-orphan-badge">No paths</span>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--wdd-accent)' }}>
                      {count} path{count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Right: paths for selected treatment */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {!selected ? (
          <div className="wdd-paths-empty">Select a treatment to see paths.</div>
        ) : (
          <>
            {(() => {
              const t = TREATMENTS[selected as TreatmentId] as Treatment;
              return (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--wdd-text-primary)' }}>{t.name}</div>
                  <div className="wdd-path-count" style={{ marginBottom: 0, marginTop: 2 }}>
                    {selectedPaths.length} path{selectedPaths.length !== 1 ? 's' : ''}
                  </div>
                </div>
              );
            })()}
            {selectedPaths.length === 0 ? (
              <div style={{ padding: '12px 0' }}>
                <div className="wdd-paths-empty" style={{ textAlign: 'left', padding: 0, marginBottom: 8 }}>
                  No wizard paths reach this treatment.
                </div>
                <button
                  className="wdd-fix-btn"
                  type="button"
                  onClick={() => onFixInEditor(selected)}
                >
                  Fix in Editor
                </button>
              </div>
            ) : (
              selectedPaths.map((p, i) => <PathBreadcrumb key={i} path={p} />)
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-view C: Orphans ───────────────────────────────────────────────────────

interface OrphansViewProps {
  allPaths: ResolvedPath[];
  onFixInEditor: (treatmentId: string) => void;
}

function OrphansView({ allPaths, onFixInEditor }: OrphansViewProps): React.ReactElement {
  const orphans = useMemo(() => {
    return orphanedTreatments(allPaths, TREATMENTS);
  }, [allPaths]);

  if (orphans.length === 0) {
    return (
      <div className="wdd-paths-success">
        All treatments have at least one path.
      </div>
    );
  }

  return (
    <div>
      <div className="wdd-path-count">{orphans.length} orphaned treatment{orphans.length !== 1 ? 's' : ''}</div>
      {orphans.map((t) => (
        <div
          key={t.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid var(--wdd-border)',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--wdd-text-primary)', marginBottom: 3 }}>
              {t.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className={categoryBadgeClass(t.category)} style={{ fontSize: 10 }}>
                {categoryLabel(t.category)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--wdd-text-secondary)' }}>
                {t.priceLabel ?? `$${t.price}`}
              </span>
              <span className="wdd-orphan-badge">No paths</span>
            </div>
          </div>
          <button
            className="wdd-fix-btn"
            type="button"
            onClick={() => onFixInEditor(t.id)}
          >
            Fix in Editor
          </button>
        </div>
      ))}
    </div>
  );
}

// ── PathsTab (root) ───────────────────────────────────────────────────────────

export function PathsTab({ allPaths, onFixInEditor }: PathsTabProps): React.ReactElement {
  const [subView, setSubView] = useState<SubView>('all');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Sub-view pill nav */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--wdd-border)', flexShrink: 0, background: 'var(--wdd-bg-surface)' }}>
        <div className="wdd-paths-subviews">
          <button
            className={`wdd-paths-pill${subView === 'all' ? ' wdd-paths-pill--active' : ''}`}
            type="button"
            onClick={() => setSubView('all')}
          >
            All Paths
          </button>
          <button
            className={`wdd-paths-pill${subView === 'byTreatment' ? ' wdd-paths-pill--active' : ''}`}
            type="button"
            onClick={() => setSubView('byTreatment')}
          >
            By Treatment
          </button>
          <button
            className={`wdd-paths-pill${subView === 'orphans' ? ' wdd-paths-pill--active' : ''}`}
            type="button"
            onClick={() => setSubView('orphans')}
          >
            Orphans
          </button>
        </div>
      </div>

      {/* Sub-view content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {subView === 'all' && (
          <div className="wdd-main" style={{ overflow: 'auto' }}>
            <AllPathsView allPaths={allPaths} />
          </div>
        )}
        {subView === 'byTreatment' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
            <ByTreatmentView allPaths={allPaths} onFixInEditor={onFixInEditor} />
          </div>
        )}
        {subView === 'orphans' && (
          <div className="wdd-main" style={{ overflow: 'auto' }}>
            <OrphansView allPaths={allPaths} onFixInEditor={onFixInEditor} />
          </div>
        )}
      </div>
    </div>
  );
}
