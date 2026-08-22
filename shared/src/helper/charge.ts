import { clamp01 } from './clamp';
import { settings } from '../settings';

export const holdDurationToCharge = (heldSeconds: number): number =>
  clamp01(heldSeconds / settings.chargeShotFullHoldSeconds);

// Inverse of the server's projectile mix(); both sides need this number, so it
// lives here rather than being derived twice.
export const strengthToCharge = (strength: number): number =>
  clamp01(
    (strength - settings.chargeShotStrengthMin) /
      (settings.chargeShotStrengthMax - settings.chargeShotStrengthMin),
  );
