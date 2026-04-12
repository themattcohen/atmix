/**
 * FlowLayout.ts -- Pure TypeScript layout engine for the decision tree flow chart.
 * No React, no side effects. Takes the question/treatment/bundle graph and returns
 * positioned nodes and bezier edge descriptors for SVG rendering.
 */

import type { Question, SingleQuestion } from '../../types/question';
import type { Treatment } from '../../types/treatment';
import type { Bundle } from '../../types/bundle';

// ── Public types ──────────────────────────────────────────────────────────────

export type NodeKind = 'question' | 'treatment' | 'bundle' | 'symptoms' | 'shared-ref';

export interface LayoutNode {
  id: string;
  /** Unique key within the layout -- for shared-refs this is `${id}::ref::${parentId}` */
  key: string;
  kind: NodeKind;
  label: string;
  sublabel?: string;
  /** data-category value for treatment nodes */
  category?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** ID of the question/node that owns this node's incoming edge */
  parentKey?: string;
  /** Option label on the incoming edge */
  optionLabel?: string;
  /** For question nodes: list of child node keys */
  childKeys: string[];
  /** For collapse button: true if this is a collapsible question node */
  collapsible: boolean;
  /** depth level (0 = root) */
  depth: number;
}

export interface LayoutEdge {
  /** key of the parent node */
  fromKey: string;
  /** key of the child node */
  toKey: string;
  label: string;
  /** absolute SVG path coords */
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface FlowLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  /** Total canvas size for SVG viewBox */
  totalWidth: number;
  totalHeight: number;
}

// ── Layout constants ──────────────────────────────────────────────────────────

const Q_WIDTH  = 180;
const Q_HEIGHT = 60;
const T_WIDTH  = 140;
const T_HEIGHT = 50;
const ROW_HEIGHT = 150;  // vertical distance between parent top and child top
const H_GAP     = 12;   // horizontal gap between sibling subtrees
const CANVAS_PAD = 40;  // padding around entire diagram
const SHARED_REF_WIDTH = 120;  // shared-ref nodes only say "see above" so they're narrower

// ── Internal tree building ────────────────────────────────────────────────────

/**
 * Intermediate tree node used during layout computation, before x/y are known.
 */
interface TreeItem {
  key: string;
  id: string;
  kind: NodeKind;
  label: string;
  sublabel?: string;
  category?: string;
  optionLabel: string;  // label of the edge coming INTO this node (empty for root)
  parentKey: string | null;
  children: TreeItem[];
  depth: number;
  /** subtree width (computed bottom-up) */
  subtreeWidth: number;
}

function nodeWidth(kind: NodeKind): number {
  if (kind === 'shared-ref') return SHARED_REF_WIDTH;
  return (kind === 'question' || kind === 'symptoms') ? Q_WIDTH : T_WIDTH;
}

function nodeHeight(kind: NodeKind): number {
  return (kind === 'question' || kind === 'symptoms') ? Q_HEIGHT : T_HEIGHT;
}

/**
 * Build the intermediate tree by walking the question graph depth-first.
 * Shared nodes (in-degree > 1) are rendered fully at their FIRST occurrence;
 * subsequent occurrences become `shared-ref` stubs with no children.
 */
function buildTree(
  questions: Record<string, Question>,
  treatments: Record<string, Treatment>,
  bundles: Record<string, Bundle>,
): TreeItem {
  // Track which question IDs have already been rendered as a full node
  const renderedQuestions = new Set<string>();

  function makeKey(id: string, parentKey: string | null, optionIdx: number): string {
    return parentKey === null ? id : `${parentKey}::${optionIdx}::${id}`;
  }

  function walkQuestion(
    qid: string,
    parentKey: string | null,
    optionLabel: string,
    optionIdx: number,
    depth: number,
    visitedInBranch: Set<string>,
  ): TreeItem {
    const key = makeKey(qid, parentKey, optionIdx);
    const q = questions[qid] as Question | undefined;

    // Symptoms (multi) -- terminal leaf
    if (q?.type === 'multi') {
      return {
        key,
        id: qid,
        kind: 'symptoms',
        label: 'Symptom Scoring',
        sublabel: q.title,
        optionLabel,
        parentKey,
        children: [],
        depth,
        subtreeWidth: Q_WIDTH,
      };
    }

    // Unknown question
    if (!q) {
      return {
        key,
        id: qid,
        kind: 'question',
        label: qid,
        sublabel: '(unknown)',
        optionLabel,
        parentKey,
        children: [],
        depth,
        subtreeWidth: Q_WIDTH,
      };
    }

    // Shared-ref: already rendered this question in ANOTHER branch, show stub
    const alreadyFullyRendered = renderedQuestions.has(qid);
    const cycleInBranch = visitedInBranch.has(qid);

    if (alreadyFullyRendered || cycleInBranch) {
      return {
        key,
        id: qid,
        kind: 'shared-ref',
        label: qid,
        sublabel: q.title,
        optionLabel,
        parentKey,
        children: [],
        depth,
        subtreeWidth: SHARED_REF_WIDTH,
      };
    }

    // Mark as rendered BEFORE recursing to prevent cyclic re-expansion
    renderedQuestions.add(qid);

    const sq = q as SingleQuestion;
    const newVisited = new Set(visitedInBranch);
    newVisited.add(qid);

    const children: TreeItem[] = sq.options.map((opt, i) => {
      const edgeLabel = opt.label;

      if (opt.recommend) {
        const isBundleId = opt.recommend in bundles;
        if (isBundleId) {
          const bundle = bundles[opt.recommend];
          const childKey = `${key}::${i}::${opt.recommend}`;
          return {
            key: childKey,
            id: opt.recommend,
            kind: 'bundle' as NodeKind,
            label: bundle?.name ?? opt.recommend,
            sublabel: 'Bundle',
            optionLabel: edgeLabel,
            parentKey: key,
            children: [],
            depth: depth + 1,
            subtreeWidth: T_WIDTH,
          };
        } else {
          const t = treatments[opt.recommend];
          const childKey = `${key}::${i}::${opt.recommend}`;
          return {
            key: childKey,
            id: opt.recommend,
            kind: 'treatment' as NodeKind,
            label: t?.name ?? opt.recommend,
            sublabel: t?.priceLabel ?? (t ? `$${t.price}` : undefined),
            category: t?.category,
            optionLabel: edgeLabel,
            parentKey: key,
            children: [],
            depth: depth + 1,
            subtreeWidth: T_WIDTH,
          };
        }
      } else if (opt.next) {
        return walkQuestion(opt.next, key, edgeLabel, i, depth + 1, newVisited);
      } else {
        const childKey = `${key}::${i}::empty`;
        return {
          key: childKey,
          id: '(empty)',
          kind: 'treatment' as NodeKind,
          label: '(no next)',
          optionLabel: edgeLabel,
          parentKey: key,
          children: [],
          depth: depth + 1,
          subtreeWidth: T_WIDTH,
        };
      }
    });

    // Compute subtree width bottom-up
    const childrenTotalWidth = children.reduce((sum, c) => sum + c.subtreeWidth, 0)
      + Math.max(0, children.length - 1) * H_GAP;
    const selfWidth = nodeWidth('question');
    const subtreeWidth = Math.max(selfWidth, childrenTotalWidth);

    return {
      key,
      id: qid,
      kind: 'question',
      label: qid,
      sublabel: sq.title,
      optionLabel,
      parentKey,
      children,
      depth,
      subtreeWidth,
    };
  }

  return walkQuestion('start', null, '', 0, 0, new Set());
}

/**
 * Assign absolute x/y coordinates to each TreeItem.
 * Parent is centered above its children.
 * Children are laid out left-to-right.
 */
function assignPositions(
  item: TreeItem,
  left: number,  // left edge of this subtree's allocated space
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  function place(node: TreeItem, subtreeLeft: number): void {
    const w = nodeWidth(node.kind);
    const y = CANVAS_PAD + node.depth * ROW_HEIGHT;

    if (node.children.length === 0) {
      // Leaf: center within its allocated subtreeWidth
      const x = subtreeLeft + (node.subtreeWidth - w) / 2;
      positions.set(node.key, { x, y });
      return;
    }

    // Lay out children first, left-to-right
    let cursor = subtreeLeft;
    for (const child of node.children) {
      place(child, cursor);
      cursor += child.subtreeWidth + H_GAP;
    }

    // Center parent over children
    const firstChildPos = positions.get(node.children[0].key);
    const lastChildPos  = positions.get(node.children[node.children.length - 1].key);
    const lastChildW    = nodeWidth(node.children[node.children.length - 1].kind);

    if (firstChildPos && lastChildPos) {
      const childrenLeft  = firstChildPos.x;
      const childrenRight = lastChildPos.x + lastChildW;
      const x = childrenLeft + (childrenRight - childrenLeft - w) / 2;
      positions.set(node.key, { x, y });
    } else {
      const x = subtreeLeft + (node.subtreeWidth - w) / 2;
      positions.set(node.key, { x, y });
    }
  }

  place(item, left);
  return positions;
}

/**
 * Flatten the tree into arrays of LayoutNode and LayoutEdge.
 */
function flatten(
  root: TreeItem,
  positions: Map<string, { x: number; y: number }>,
): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];

  function visit(item: TreeItem): void {
    const pos = positions.get(item.key);
    if (!pos) return;

    const w = nodeWidth(item.kind);
    const h = nodeHeight(item.kind);
    const collapsible = item.kind === 'question' && item.children.length > 0;

    nodes.push({
      id: item.id,
      key: item.key,
      kind: item.kind,
      label: item.label,
      sublabel: item.sublabel,
      category: item.category,
      x: pos.x,
      y: pos.y,
      width: w,
      height: h,
      parentKey: item.parentKey ?? undefined,
      optionLabel: item.optionLabel || undefined,
      childKeys: item.children.map((c) => c.key),
      collapsible,
      depth: item.depth,
    });

    if (item.parentKey !== null) {
      const parentPos = positions.get(item.parentKey);
      if (parentPos) {
        const parentW = nodeWidth(
          // We don't have parent kind here easily -- assume question height
          'question',
        );
        const parentH = nodeHeight('question');
        edges.push({
          fromKey: item.parentKey,
          toKey: item.key,
          label: item.optionLabel,
          fromX: parentPos.x + parentW / 2,
          fromY: parentPos.y + parentH,
          toX: pos.x + w / 2,
          toY: pos.y,
        });
      }
    }

    for (const child of item.children) {
      visit(child);
    }
  }

  visit(root);
  return { nodes, edges };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function computeFlowLayout(
  questions: Record<string, Question>,
  treatments: Record<string, Treatment>,
  bundles: Record<string, Bundle>,
): FlowLayout {
  const root = buildTree(questions, treatments, bundles);
  const positions = assignPositions(root, CANVAS_PAD);
  const { nodes, edges } = flatten(root, positions);

  // Compute canvas dimensions
  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }

  return {
    nodes,
    edges,
    totalWidth: maxX + CANVAS_PAD,
    totalHeight: maxY + CANVAS_PAD,
  };
}
