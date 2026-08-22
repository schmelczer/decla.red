import { clamp01 } from './clamp';
import { settings } from '../settings';

export const holdDurationToCharge = (heldSeconds: number): number =>
  clamp01(heldSeconds / settings.chargeShotFullHoldSeconds);

// The charge a shot of this strength represents — the inverse of the mix() the
// server uses to size a projectile. The server needs it to scale radius, speed
// and recoil; the client needs the same number to pitch the sound and the
// muzzle flash, so it lives here rather than being derived twice.
export const strengthToCharge = (strength: number): number =>
  clamp01(
    (strength - settings.chargeShotStrengthMin) /
      (settings.chargeShotStrengthMax - settings.chargeShotStrengthMin),
  );
