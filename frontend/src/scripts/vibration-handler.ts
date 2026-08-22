import { OptionsHandler } from './options-handler';

export const VibrationHandler = {
  vibrate(pattern: number | number[]) {
    if (OptionsHandler.options.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  },
  get isVibrationEnabled() {
    return 'vibrate' in navigator;
  },
  get isVibrationEnabledHeuristics() {
    return 'vibrate' in navigator && 'ontouchstart' in window;
  },
};
