import { getActiveForItem, triggerTarget } from '../db/targets'
import { insert as insertEvent } from '../db/events'
import type { PriceTarget } from '../../types'

/**
 * Evaluate all active price targets for a single item against its current price.
 * Called once per item per sync cycle, after the item has been upserted and
 * its snapshot inserted.
 *
 * Targets are evaluated independently: multiple targets on the same item
 * can all trigger in the same sync cycle if the price crosses all thresholds.
 *
 * @param itemId             eBay item ID
 * @param currentPriceCents  Fresh price from the API, in USD cents
 */
export function evaluateTargets(itemId: string, currentPriceCents: number): void {
  const targets = getActiveForItem(itemId)
  if (targets.length === 0) return

  for (const target of targets) {
    if (shouldTrigger(target, currentPriceCents)) {
      triggerTarget(target.id, currentPriceCents)
      insertEvent({
        itemId,
        eventType: 'target_triggered',
        oldValue: String(target.targetCents),  // threshold the user set
        newValue: String(currentPriceCents),    // actual price at trigger moment
      })
    }
  }
}

/**
 * Determine whether a single active target should fire given the current price.
 *
 * buy_below:  fires when currentPriceCents <= target.targetCents (inclusive)
 * sell_above: fires when currentPriceCents >= target.targetCents (inclusive)
 *
 * Both use inclusive comparisons — "buy below $45" includes exactly $45.
 */
export function shouldTrigger(target: PriceTarget, currentPriceCents: number): boolean {
  if (target.targetType === 'buy_below') {
    return currentPriceCents <= target.targetCents
  }
  if (target.targetType === 'sell_above') {
    return currentPriceCents >= target.targetCents
  }
  return false
}
