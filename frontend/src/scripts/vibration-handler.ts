import { OptionsHandler } from './options-handler';

export abstract class VibrationHandler {
  public static vibrate(time: number): void {
    if (OptionsHandler.options.vibrationEnabled && this.isVibrationEnabled) {
      navigator.vibrate(time);
    }
  }

  public static get isVibrationEnabled(): boolean {
    return 'vibrate' in navigator;
  }

  public static get isVibrationEnabledHeuristics(): boolean {
    return this.isVibrationEnabled && 'ontouchstart' in window;
  }
}
