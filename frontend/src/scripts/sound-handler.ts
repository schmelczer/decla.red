import hitSound from '../../static/hit.mp3';
import shootSound from '../../static/shoot.mp3';
import clickSound from '../../static/click.mp3';
import ambientAudio from '../../static/ambient.mp3';
import { OptionsHandler } from './options-handler';

export const Sounds = { hit: 'hit', shoot: 'shoot', click: 'click' } as const;
export type Sound = (typeof Sounds)[keyof typeof Sounds];

let sounds: Record<Sound, HTMLAudioElement>;
let isAmbientPlaying = false;
const ambientSnd = new Audio(ambientAudio);
let initialized = false;

async function initializeSound(src: string): Promise<HTMLAudioElement> {
  const snd = new Audio(src);
  snd.muted = true;
  await snd.play();
  snd.pause();
  snd.muted = false;
  snd.currentTime = 0;
  return snd;
}

async function initialize(
  onPlayKeypress: () => unknown = () => null,
  onPauseKeypress: () => unknown = () => null,
) {
  sounds = {
    hit: await initializeSound(hitSound),
    shoot: await initializeSound(shootSound),
    click: await initializeSound(clickSound),
  };

  await ambientSnd.play();
  ambientSnd.muted = true;
  initialized = true;
  ambientSnd.onpause = onPauseKeypress;
  ambientSnd.onplay = onPlayKeypress;

  ambientSnd.muted = false;
  ambientSnd.volume = 0.5;
  ambientSnd.loop = true;

  if (!isAmbientPlaying) {
    ambientSnd.pause();
  }
}

function play(snd: Sound, volume = 1, playbackRate = 1) {
  if (!initialized || !OptionsHandler.options.soundsEnabled) {
    return;
  }

  const pooled = sounds[snd];
  const isBusy = !pooled.paused && !pooled.ended;
  const audio = isBusy ? (pooled.cloneNode(true) as HTMLAudioElement) : pooled;
  if (!isBusy) {
    audio.currentTime = 0;
  }
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.playbackRate = playbackRate;
  void audio.play().catch(() => undefined);
}

function playAmbient() {
  isAmbientPlaying = true;
  if (initialized) {
    ambientSnd.play();
  }
}

function stopAmbient() {
  isAmbientPlaying = false;
  if (initialized) {
    ambientSnd.pause();
  }
}

export const SoundHandler = {
  initialize,
  play,
  playAmbient,
  stopAmbient,
};
