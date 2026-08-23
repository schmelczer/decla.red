import { clamp01 } from './clamp';
import { settings } from '../settings';

export const holdDurationToCharge = (heldSeconds: number): number =>
  clamp01(heldSeconds / settings.chargeShotFullHoldSeconds);

export const chargeHeldSince = (heldSinceMs: number): number =>
  holdDurationToCharge((performance.now() - heldSinceMs) / 1000);

export const strengthToCharge = (strength: number): number =>
  clamp01(
    (strength - settings.chargeShotStrengthMin) /
      (settings.chargeShotStrengthMax - settings.chargeShotStrengthMin),
  );
