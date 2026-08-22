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

export abstract class SoundHandler {
  private static sounds: { [key in Sounds]: HTMLAudioElement };
  private static isAmbientPlaying = false;

  private static ambientSound = new Audio(ambientSound);

  private static initialized = false;
  public static async initialize(
    onPlayKeypress: () => unknown = () => null,
    onPauseKeypress: () => unknown = () => null,
  ) {
    this.sounds = {
      [Sounds.hit]: await this.initializeSound(hitSound),
      [Sounds.shoot]: await this.initializeSound(shootSound),
      [Sounds.click]: await this.initializeSound(clickSound),
    };

    await this.ambientSound.play();
    this.ambientSound.muted = true;
    this.initialized = true;
    this.ambientSound.onpause = onPauseKeypress;
    this.ambientSound.onplay = onPlayKeypress;

    this.ambientSound.muted = false;
    this.ambientSound.volume = 0.5;
    this.ambientSound.loop = true;

    if (!this.isAmbientPlaying) {
      this.ambientSound.pause();
    }
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

  public static play(sound: Sounds, volume = 1, playbackRate = 1) {
    if (!this.initialized || !OptionsHandler.options.soundsEnabled) {
      return;
    }

    // Reuse the pooled element unless it is still mid-playback; only overlapping
    // sounds need a clone. Testing `currentTime > 0` instead stayed true forever
    // after the first play, so every later effect allocated a fresh element.
    const pooled = this.sounds[sound];
    const isBusy = !pooled.paused && !pooled.ended;
    const audio = isBusy ? (pooled.cloneNode(true) as HTMLAudioElement) : pooled;
    if (!isBusy) {
      audio.currentTime = 0;
    }
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.playbackRate = playbackRate;
    // A rejected play() (autoplay policy, or a clone GC'd mid-play) is expected
    // and must not surface as an unhandled rejection.
    void audio.play().catch(() => undefined);
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
