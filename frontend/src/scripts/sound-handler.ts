import hitSound from '../../static/hit.mp3';
import shootSound from '../../static/shoot.mp3';
import clickSound from '../../static/click.mp3';
import ambientSound from '../../static/ambient.mp3';
import { OptionsHandler } from './options-handler';

export enum Sounds {
  hit = 'hit',
  shoot = 'shoot',
  click = 'click',
  ambient = 'ambient',
}

export abstract class SoundHandler {
  private static sounds: { [key in Sounds]: HTMLAudioElement };

  public static initialize() {
    this.sounds = {
      [Sounds.hit]: new Audio(hitSound),
      [Sounds.shoot]: new Audio(shootSound),
      [Sounds.click]: new Audio(clickSound),
      [Sounds.ambient]: new Audio(ambientSound),
    };
    this.sounds.ambient.volume = 0.5;
  }

  public static play(sound: Sounds) {
    if (OptionsHandler.options.soundsEnabled) {
      if (this.sounds[sound].currentTime > 0) {
        (this.sounds[sound].cloneNode() as HTMLAudioElement).play();
      } else {
        this.sounds[sound].play();
      }
    }
  }

  public static playAmbient() {
    this.sounds.ambient.play();
  }

  public static stopAmbient() {
    this.sounds.ambient.pause();
  }
}
