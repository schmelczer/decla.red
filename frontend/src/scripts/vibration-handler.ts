import { OptionsHandler } from './options-handler';

export abstract class VibrationHandler {
  public static vibrate(time: number): void {
    if (OptionsHandler.options.vibrationEnabled) {
      navigator?.vibrate(time);
    }
  }
}
