import { options } from './options-handler';

export const VibrationHandler = {
  vibrate(pattern: number | number[]) {
    if (options.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  },
  get isVibrationEnabledHeuristics() {
    return 'vibrate' in navigator && 'ontouchstart' in window;
  },
};
