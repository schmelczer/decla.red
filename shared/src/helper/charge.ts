import { clamp01 } from './clamp';
import { settings } from '../settings';

export const chargeHeldSince = (heldSinceMs: number): number =>
  clamp01((performance.now() - heldSinceMs) / 1000 / settings.chargeShotFullHoldSeconds);

export const strengthToCharge = (strength: number): number =>
  clamp01(
    (strength - settings.chargeShotStrengthMin) /
      (settings.chargeShotStrengthMax - settings.chargeShotStrengthMin),
  );
