import { clamp01 } from 'shared';
import hitSound from '../../static/hit.mp3';
import shootSound from '../../static/shoot.mp3';
import clickSound from '../../static/click.mp3';
import ambientAudio from '../../static/ambient.mp3';
import { options } from './options-handler';

export const Sounds = { hit: 'hit', shoot: 'shoot', click: 'click' } as const;
export type Sound = (typeof Sounds)[keyof typeof Sounds];

const sounds: Partial<Record<Sound, AudioBuffer>> = {};
const maxVoices = 16;
const voices = new Set<{ source: AudioBufferSourceNode; gain: GainNode }>();
let context: AudioContext | undefined;
let initialization: Promise<void> | undefined;
let isAmbientPlaying = false;
const ambient = new Audio(ambientAudio);
let ambientInitialized = false;

async function initializeEffects() {
  try {
    context = new AudioContext({ latencyHint: 'interactive' });
  } catch {
    return;
  }
  const audioContext = context;
  // Unlock during the initiating gesture, before any network or decode work.
  void audioContext.resume().catch(() => undefined);
  await Promise.all(
    Object.entries({ hit: hitSound, shoot: shootSound, click: clickSound }).map(
      async ([name, src]) => {
        try {
          const response = await fetch(src);
          if (response.ok) {
            sounds[name as Sound] = await audioContext.decodeAudioData(
              await response.arrayBuffer(),
            );
          }
        } catch {
          // Missing audio must not interrupt gameplay or prevent other effects loading.
        }
      },
    ),
  );
}

async function initializeAmbient(
  onPlayKeypress: () => unknown,
  onPauseKeypress: () => unknown,
) {
  ambient.muted = true;
  ambient.volume = 0.5;
  ambient.loop = true;
  await ambient.play().catch(() => undefined);
  ambientInitialized = true;
  ambient.onpause = onPauseKeypress;
  ambient.onplay = onPlayKeypress;

  ambient.muted = false;

  if (!isAmbientPlaying) {
    ambient.pause();
  }
}

function initialize(
  onPlayKeypress: () => unknown = () => null,
  onPauseKeypress: () => unknown = () => null,
): Promise<void> {
  if (!initialization) {
    initialization = initializeEffects();
    // Streaming music can take much longer to load than the short effects.
    void initializeAmbient(onPlayKeypress, onPauseKeypress);
  }
  return initialization;
}

function play(snd: Sound, volume = 1, playbackRate = 1) {
  const buffer = sounds[snd];
  if (!context || !buffer || !options.soundsEnabled) {
    return;
  }
  if (context.state !== 'running') {
    void context.resume().catch(() => undefined);
    return;
  }

  // Delayed network packets can deliver many effects together. Keep their audio work bounded.
  if (voices.size >= maxVoices) {
    const oldest = voices.values().next().value!;
    oldest.source.stop();
    oldest.source.disconnect();
    oldest.gain.disconnect();
    voices.delete(oldest);
  }

  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  source.playbackRate.value = playbackRate;
  gain.gain.value = clamp01(volume);
  source.connect(gain);
  gain.connect(context.destination);
  const voice = { source, gain };
  voices.add(voice);
  source.onended = () => {
    if (voices.delete(voice)) {
      source.disconnect();
      gain.disconnect();
    }
  };
  source.start();
}

function playAmbient() {
  isAmbientPlaying = true;
  if (ambientInitialized) {
    void ambient.play().catch(() => undefined);
  }
}

function stopAmbient() {
  isAmbientPlaying = false;
  if (ambientInitialized) {
    ambient.pause();
  }
}

export const SoundHandler = {
  initialize,
  play,
  playAmbient,
  stopAmbient,
};
