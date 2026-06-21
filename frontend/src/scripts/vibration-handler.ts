import { OptionsHandler } from './options-handler';

export abstract class VibrationHandler {
  // Accepts either a single duration or an on/off pattern (e.g. a double-thump
  // [40, 30, 90] for a kill).
  public static vibrate(pattern: number | number[]): void {
    if (OptionsHandler.options.vibrationEnabled && this.isVibrationEnabled) {
      navigator.vibrate(pattern);
    }
  }

  public static get isVibrationEnabled(): boolean {
    return 'vibrate' in navigator;
  }

  public static get isVibrationEnabledHeuristics(): boolean {
    return this.isVibrationEnabled && 'ontouchstart' in window;
  }
}
