import { SoundHandler, Sounds } from './sound-handler';
import { VibrationHandler } from './vibration-handler';

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

const save = () => localStorage.setItem('options', JSON.stringify(options));

export const initializeOptions = (
  inputElements: Record<keyof Options, HTMLInputElement>,
) => {
  const stored = localStorage.getItem('options');
  if (stored) {
    Object.assign(options, JSON.parse(stored));
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
      save();
    });
  }
};
