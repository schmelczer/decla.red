import { clamp01 } from 'shared';
import hitSound from '../../static/hit.mp3';
import shootSound from '../../static/shoot.mp3';
import clickSound from '../../static/click.mp3';
import ambientAudio from '../../static/ambient.mp3';
import { options } from './options-handler';

export const Sounds = { hit: 'hit', shoot: 'shoot', click: 'click' } as const;
export type Sound = (typeof Sounds)[keyof typeof Sounds];

let sounds: Record<Sound, HTMLAudioElement>;
let isAmbientPlaying = false;
const ambient = new Audio(ambientAudio);
let initialized = false;

async function initializeSound(src: string): Promise<HTMLAudioElement> {
  const snd = new Audio(src);
  snd.muted = true;
  await snd.play().catch(() => undefined);
  snd.pause();
  snd.muted = false;
  snd.currentTime = 0;
  return snd;
}

async function initialize(
  onPlayKeypress: () => unknown = () => null,
  onPauseKeypress: () => unknown = () => null,
) {
  ambient.muted = true;
  ambient.volume = 0.5;
  ambient.loop = true;
  // Unlock every audio element during the initiating click, before awaiting any one.
  const ambientReady = ambient.play().catch(() => undefined);
  const [hit, shoot, click] = await Promise.all(
    [hitSound, shootSound, clickSound].map(initializeSound),
  );
  sounds = { hit, shoot, click };

  await ambientReady;
  initialized = true;
  ambient.onpause = onPauseKeypress;
  ambient.onplay = onPlayKeypress;

  ambient.muted = false;

  if (!isAmbientPlaying) {
    ambient.pause();
  }
}

function play(snd: Sound, volume = 1, playbackRate = 1) {
  if (!initialized || !options.soundsEnabled) {
    return;
  }

  const pooled = sounds[snd];
  const isBusy = !pooled.paused && !pooled.ended;
  const audio = isBusy ? (pooled.cloneNode(true) as HTMLAudioElement) : pooled;
  if (!isBusy) {
    audio.currentTime = 0;
  }
  audio.volume = clamp01(volume);
  audio.playbackRate = playbackRate;
  void audio.play().catch(() => undefined);
}

function playAmbient() {
  isAmbientPlaying = true;
  if (initialized) {
    void ambient.play().catch(() => undefined);
  }
}

function stopAmbient() {
  isAmbientPlaying = false;
  if (initialized) {
    ambient.pause();
  }
}

export const SoundHandler = {
  initialize,
  play,
  playAmbient,
  stopAmbient,
};
