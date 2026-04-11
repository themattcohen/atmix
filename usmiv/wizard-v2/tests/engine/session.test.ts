import { describe, it, expect } from 'vitest';
import {
  addToSessionPure,
  removeFromSessionPure,
  calculateSessionTotal,
  buildSessionNotes,
} from '../../src/engine/session';
import { RULES } from '../../src/constants/rules';
import type { SessionItem } from '../../src/types/session';

// Helpers to build SessionItems with minimal boilerplate
function makePrimary(id: string, name: string, price: number): SessionItem {
  return { treatmentId: id as SessionItem['treatmentId'], name, price, isInjection: false };
}

function makeInjection(id: string, name: string, price: number = 35): SessionItem {
  return { treatmentId: id as SessionItem['treatmentId'], name, price, isInjection: true };
}

const myersItem = makePrimary('myers', "Myers' Cocktail", 220);
const myersGoldItem = makePrimary('myersGold', "Myers' Gold", 275);
const b12Item = makeInjection('b12Shot', 'B12 Injection');
const glutItem = makeInjection('glutathioneShot', 'Glutathione Injection');
const biotinItem = makeInjection('biotinShot', 'Biotin Injection');
const vitDItem = makeInjection('vitaminDShot', 'Vitamin D Injection');

describe('addToSessionPure', () => {
  it('add primary: session has 1 primary, 0 injections', () => {
    const result = addToSessionPure([], myersItem);
    expect(result).toHaveLength(1);
    expect(result[0].treatmentId).toBe('myers');
    expect(result[0].isInjection).toBe(false);
  });

  it('add injection: session has 1 addon', () => {
    const result = addToSessionPure([], b12Item);
    expect(result).toHaveLength(1);
    expect(result[0].isInjection).toBe(true);
  });

  it('add primary then injection: session has 1 primary + 1 addon', () => {
    let items = addToSessionPure([], myersItem);
    items = addToSessionPure(items, b12Item);
    expect(items).toHaveLength(2);
    const primaries = items.filter((i) => !i.isInjection);
    const injections = items.filter((i) => i.isInjection);
    expect(primaries).toHaveLength(1);
    expect(injections).toHaveLength(1);
  });

  it('max injections: adding a 4th injection is rejected (max is RULES.MAX_INJECTIONS = 3)', () => {
    let items = addToSessionPure([], b12Item);
    items = addToSessionPure(items, glutItem);
    items = addToSessionPure(items, biotinItem);
    // 3 injections present -- 4th should be rejected
    const before = items.length;
    const after = addToSessionPure(items, vitDItem);
    expect(after).toHaveLength(before); // unchanged
    expect(after.filter((i) => i.isInjection)).toHaveLength(RULES.MAX_INJECTIONS);
  });

  it('replace primary: adding a second non-injection primary replaces the first', () => {
    let items = addToSessionPure([], myersItem);
    items = addToSessionPure(items, b12Item); // add addon first
    items = addToSessionPure(items, myersGoldItem); // should replace myers

    const primaries = items.filter((i) => !i.isInjection);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].treatmentId).toBe('myersGold');

    // Injection should be preserved
    const injections = items.filter((i) => i.isInjection);
    expect(injections).toHaveLength(1);
    expect(injections[0].treatmentId).toBe('b12Shot');
  });

  it('duplicate treatment ID is silently ignored', () => {
    const items = addToSessionPure([], myersItem);
    const result = addToSessionPure(items, myersItem);
    expect(result).toHaveLength(1); // no duplicate
  });

  it('never mutates the input array', () => {
    const original: readonly SessionItem[] = [];
    const result = addToSessionPure(original, myersItem);
    expect(result).not.toBe(original);
    expect(original).toHaveLength(0);
  });
});

describe('removeFromSessionPure', () => {
  it('remove addon: addon list becomes empty', () => {
    let items = addToSessionPure([], myersItem);
    items = addToSessionPure(items, b12Item);
    const result = removeFromSessionPure(items, 'b12Shot');
    expect(result.some((i) => i.treatmentId === 'b12Shot')).toBe(false);
    expect(result).toHaveLength(1);
  });

  it('remove primary: primary is removed, injections remain', () => {
    let items = addToSessionPure([], myersItem);
    items = addToSessionPure(items, b12Item);
    const result = removeFromSessionPure(items, 'myers');
    expect(result.some((i) => i.treatmentId === 'myers')).toBe(false);
    expect(result).toHaveLength(1);
    expect(result[0].isInjection).toBe(true);
  });

  it('removing nonexistent ID returns same items unchanged', () => {
    const items = addToSessionPure([], myersItem);
    const result = removeFromSessionPure(items, 'nonexistent');
    expect(result).toHaveLength(1);
  });

  it('never mutates the input array', () => {
    const items = addToSessionPure([], myersItem);
    const result = removeFromSessionPure(items, 'myers');
    expect(result).not.toBe(items);
    expect(items).toHaveLength(1); // original unchanged
  });
});

describe('calculateSessionTotal', () => {
  it('empty session has total 0', () => {
    expect(calculateSessionTotal([])).toBe(0);
  });

  it('primary only: total equals primary price', () => {
    const items = addToSessionPure([], myersItem);
    expect(calculateSessionTotal(items)).toBe(220);
  });

  it('primary ($220) + 2 addons ($35 each) = $290', () => {
    let items = addToSessionPure([], myersItem);
    items = addToSessionPure(items, b12Item);
    items = addToSessionPure(items, glutItem);
    expect(calculateSessionTotal(items)).toBe(220 + 35 + 35);
  });

  it('3 injections only: total = 105', () => {
    let items = addToSessionPure([], b12Item);
    items = addToSessionPure(items, glutItem);
    items = addToSessionPure(items, biotinItem);
    expect(calculateSessionTotal(items)).toBe(35 * 3);
  });
});

describe('buildSessionNotes', () => {
  it('empty session returns empty string', () => {
    expect(buildSessionNotes([])).toBe('');
  });

  it('primary only: "Session: Myers\' Cocktail"', () => {
    const items = addToSessionPure([], myersItem);
    expect(buildSessionNotes(items)).toBe("Session: Myers' Cocktail");
  });

  it('primary + 2 addons: "Session: Myers\' Cocktail + B12 Injection, Glutathione Injection"', () => {
    let items = addToSessionPure([], myersItem);
    items = addToSessionPure(items, b12Item);
    items = addToSessionPure(items, glutItem);
    expect(buildSessionNotes(items)).toBe(
      "Session: Myers' Cocktail + B12 Injection, Glutathione Injection",
    );
  });

  it('injections only (no primary): "Session: B12 Injection, Glutathione Injection"', () => {
    let items = addToSessionPure([], b12Item);
    items = addToSessionPure(items, glutItem);
    expect(buildSessionNotes(items)).toBe(
      'Session: B12 Injection, Glutathione Injection',
    );
  });

  it('single injection only: "Session: B12 Injection"', () => {
    const items = addToSessionPure([], b12Item);
    expect(buildSessionNotes(items)).toBe('Session: B12 Injection');
  });
});
