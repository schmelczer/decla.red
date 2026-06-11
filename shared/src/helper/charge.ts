import { clamp01 } from './clamp';
import { settings } from '../settings';

export const holdDurationToCharge = (heldSeconds: number): number =>
  clamp01(heldSeconds / settings.chargeShotFullHoldSeconds);
