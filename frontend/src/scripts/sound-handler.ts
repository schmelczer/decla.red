import hitSound from '../../static/hit.mp3';
import shootSound from '../../static/shoot.mp3';
import clickSound from '../../static/click.mp3';
import ambientSound from '../../static/ambient.mp3';
import { OptionsHandler } from './options-handler';

export enum Sounds {
  hit = 'hit',
  shoot = 'shoot',
  click = 'click',
}

const concurrencyScale = 5;

export abstract class SoundHandler {
  private static sounds: { [key in Sounds]: HTMLAudioElement };
  private static isAmbientPlaying = false;

  private static ambientSound = new Audio(ambientSound);

  private static initialized = false;
  public static async initialize() {
    this.sounds = {
      [Sounds.hit]: await this.initializeSound(hitSound),
      [Sounds.shoot]: await this.initializeSound(shootSound),
      [Sounds.click]: await this.initializeSound(clickSound),
    };

    this.ambientSound.play();
    this.ambientSound.muted = true;
    this.initialized = true;

    setTimeout(() => {
      this.ambientSound.muted = false;
      this.ambientSound.volume = 0.5;
      if (!this.isAmbientPlaying) {
        this.ambientSound.pause();
      }
    }, 100);
  }

  private static async initializeSound(hitSound: string): Promise<HTMLAudioElement> {
    const sound = new Audio(hitSound);
    sound.muted = true;
    await sound.play();
    sound.pause();
    sound.muted = false;
    sound.currentTime = 0;
    return sound;
  }

  public static play(sound: Sounds, volume: number = 1) {
    if (!this.initialized || !OptionsHandler.options.soundsEnabled) {
      return;
    }

    const audio =
      this.sounds[sound].currentTime > 0
        ? (this.sounds[sound].cloneNode(true) as HTMLAudioElement)
        : this.sounds[sound];
    audio.volume = volume;
    audio.play();
  }

  public static playAmbient() {
    this.isAmbientPlaying = true;
    if (this.initialized) {
      this.ambientSound.play();
    }
  }

  public static stopAmbient() {
    this.isAmbientPlaying = false;
    if (this.initialized) {
      this.ambientSound.pause();
    }
  }
}
