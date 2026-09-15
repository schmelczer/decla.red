import { SoundHandler, Sounds } from './sound-handler';
import { VibrationHandler } from './vibration-handler';
import { loadStoredValue, saveStoredValue } from './helper/storage';

export interface Options {
  vibrationEnabled: boolean;
  soundsEnabled: boolean;
  musicEnabled: boolean;
}

export const options: Options = {
  vibrationEnabled: true,
  soundsEnabled: true,
  musicEnabled: true,
};

export const initializeOptions = (
  inputElements: Record<keyof Options, HTMLInputElement>,
) => {
  const stored = loadStoredValue('options');
  if (stored && typeof stored === 'object') {
    for (const key of Object.keys(inputElements) as Array<keyof Options>) {
      const value = (stored as Partial<Options>)[key];
      if (typeof value === 'boolean') {
        options[key] = value;
      }
    }
  }

  if (options.musicEnabled) {
    SoundHandler.playAmbient();
  }

  for (const key of Object.keys(inputElements) as Array<keyof Options>) {
    const element = inputElements[key];
    element.checked = options[key];
    element.addEventListener('change', () => {
      options[key] = element.checked;
      if (!element.checked && key === 'soundsEnabled') {
        options.musicEnabled = false;
        inputElements.musicEnabled.checked = false;
        SoundHandler.stopAmbient();
      }

      if (key === 'musicEnabled') {
        if (element.checked) {
          SoundHandler.playAmbient();
        } else {
          SoundHandler.stopAmbient();
        }
      }

      if (element.checked && key === 'vibrationEnabled') {
        VibrationHandler.vibrate(100);
      }

      SoundHandler.play(Sounds.click);
      saveStoredValue('options', options);
    });
  }
};
