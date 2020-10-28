import { SoundHandler, Sounds } from './sound-handler';
import { VibrationHandler } from './vibration-handler';

interface Options {
  vibrationEnabled: boolean;
  soundsEnabled: boolean;
  musicEnabled: boolean;
}

export abstract class OptionsHandler {
  private static initialized = false;
  private static _options: Options = {
    vibrationEnabled: true,
    soundsEnabled: true,
    musicEnabled: true,
  };

  public static initialize(
    inputElements: { [k in Extract<keyof Options, string>]: HTMLInputElement },
  ) {
    if (localStorage.getItem('options')) {
      const stored: Partial<Options> | null = JSON.parse(
        localStorage.getItem('options')!,
      );
      this._options = {
        ...this._options,
        ...stored,
      };
    }

    if (this._options.musicEnabled) {
      SoundHandler.playAmbient();
    }

    for (const k in inputElements) {
      const element = inputElements[k as keyof Options];
      element.checked = OptionsHandler._options[k as keyof Options];
      element.addEventListener('change', function () {
        OptionsHandler._options[k as keyof Options] = this.checked;
        if (!this.checked && k === 'soundsEnabled') {
          OptionsHandler._options.musicEnabled = false;
          inputElements.musicEnabled.checked = false;
          SoundHandler.stopAmbient();
        }

        if (k === 'musicEnabled') {
          this.checked ? SoundHandler.playAmbient() : SoundHandler.stopAmbient();
        }

        if (this.checked && k === 'vibrationEnabled') {
          VibrationHandler.vibrate(100);
        }

        SoundHandler.play(Sounds.click);
        OptionsHandler.save();
      });
    }

    this.initialized = true;
  }

  private static save() {
    localStorage.setItem('options', JSON.stringify(this._options));
  }

  public static get options(): Options {
    if (!this.initialized) {
      throw new Error('Uninitialized');
    }

    return this._options;
  }
}
