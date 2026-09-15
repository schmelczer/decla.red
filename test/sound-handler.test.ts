import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { options } = vi.hoisted(() => ({ options: { soundsEnabled: true } }));
vi.mock('../frontend/src/scripts/options-handler', () => ({ options }));

class FakeAudio {
  static instances: FakeAudio[] = [];
  static ready: Promise<void>;
  muted = false;
  paused = true;
  ended = false;
  currentTime = 0;
  volume = 1;
  playbackRate = 1;
  loop = false;
  onpause?: () => unknown;
  onplay?: () => unknown;
  constructor(public src: string) {
    FakeAudio.instances.push(this);
  }
  play = vi.fn(() => {
    this.paused = false;
    return FakeAudio.ready;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  cloneNode() {
    return new FakeAudio(this.src);
  }
}

class FakeSource {
  buffer: unknown;
  playbackRate = { value: 1 };
  onended?: () => void;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state = 'running';
  destination = {};
  sources: FakeSource[] = [];
  gains: ReturnType<FakeAudioContext['createGain']>[] = [];
  resume = vi.fn(async () => undefined);
  decodeAudioData = vi.fn(async (data: ArrayBuffer) => ({ data }));
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  createGain(): {
    gain: { value: number };
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  } {
    const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
    this.gains.push(gain);
    return gain;
  }
}

const load = () => import('../frontend/src/scripts/sound-handler');

beforeEach(() => {
  vi.resetModules();
  options.soundsEnabled = true;
  FakeAudio.instances = [];
  FakeAudio.ready = Promise.resolve();
  FakeAudioContext.instances = [];
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sound playback under a slow connection', () => {
  it('reuses decoded audio without making media players or requests for overlapping shots', async () => {
    const { SoundHandler, Sounds } = await load();
    await SoundHandler.initialize();
    const players = FakeAudio.instances.length;
    const requests = vi.mocked(fetch).mock.calls.length;

    for (let i = 0; i < 80; i++) SoundHandler.play(Sounds.shoot, 0.7, 0.8);

    expect(FakeAudio.instances).toHaveLength(players);
    expect(fetch).toHaveBeenCalledTimes(requests);
    const context = FakeAudioContext.instances[0];
    expect(context.decodeAudioData).toHaveBeenCalledTimes(3);
    expect(context.sources).toHaveLength(80);
    expect(new Set(context.sources.map((s) => s.buffer)).size).toBe(1);
    expect(context.sources.every((s) => s.start.mock.calls.length === 1)).toBe(true);
    expect(context.sources.every((s) => s.playbackRate.value === 0.8)).toBe(true);
    expect(context.gains.every((g) => g.gain.value === 0.7)).toBe(true);
  });

  it('allows loaded effects to play while music or another effect is still loading', async () => {
    FakeAudio.ready = new Promise(() => {});
    vi.mocked(fetch).mockImplementation(async (src) =>
      String(src).includes('hit.mp3')
        ? new Promise(() => {})
        : ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as Response),
    );
    const { SoundHandler, Sounds } = await load();
    void SoundHandler.initialize();
    await vi.waitFor(() =>
      expect(FakeAudioContext.instances[0]?.decodeAudioData).toHaveBeenCalledTimes(2),
    );
    SoundHandler.play(Sounds.shoot);
    expect(FakeAudioContext.instances[0].sources[0].start).toHaveBeenCalledOnce();
  });

  it('drops effects that are not ready instead of replaying a backlog after loading', async () => {
    let resolve!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((r) => (resolve = r)));
    const { SoundHandler, Sounds } = await load();
    const ready = SoundHandler.initialize();
    for (let i = 0; i < 80; i++) SoundHandler.play(Sounds.shoot);
    expect(FakeAudioContext.instances[0].sources).toHaveLength(0);

    resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as Response);
    await ready;
    expect(FakeAudioContext.instances[0].sources).toHaveLength(0);
    SoundHandler.play(Sounds.shoot);
    expect(FakeAudioContext.instances[0].sources).toHaveLength(1);
  });

  it('bounds overlapping voices and disconnects both stolen and finished sounds', async () => {
    const { SoundHandler, Sounds } = await load();
    await SoundHandler.initialize();
    for (let i = 0; i < 80; i++) SoundHandler.play(Sounds.shoot);
    const context = FakeAudioContext.instances[0];
    const stopped = context.sources.filter((s) => s.stop.mock.calls.length > 0);
    const active = context.sources.filter((s) => s.stop.mock.calls.length === 0);
    expect(active.length).toBeGreaterThan(1);
    expect(active.length).toBeLessThanOrEqual(16);
    expect(stopped.every((s) => s.disconnect.mock.calls.length === 1)).toBe(true);

    const last = context.sources[context.sources.length - 1];
    last.onended?.();
    expect(last.disconnect).toHaveBeenCalledOnce();
    expect(context.gains[context.gains.length - 1].disconnect).toHaveBeenCalledOnce();
  });

  it('initializes only once and respects the sound toggle and volume limits', async () => {
    const { SoundHandler, Sounds } = await load();
    await Promise.all([SoundHandler.initialize(), SoundHandler.initialize()]);
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(3);
    const context = FakeAudioContext.instances[0];
    expect(context.resume).toHaveBeenCalledOnce();
    options.soundsEnabled = false;
    SoundHandler.play(Sounds.shoot);
    expect(context.sources).toHaveLength(0);
    options.soundsEnabled = true;
    SoundHandler.play(Sounds.hit, 2);
    expect(context.gains[0].gain.value).toBe(1);
  });

  it('keeps playback harmless when audio is unavailable or an asset fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    const { SoundHandler, Sounds } = await load();
    await expect(SoundHandler.initialize()).resolves.toBeUndefined();
    expect(() => SoundHandler.play(Sounds.shoot)).not.toThrow();
    expect(FakeAudioContext.instances[0].sources).toHaveLength(0);

    vi.resetModules();
    vi.stubGlobal('AudioContext', undefined);
    const unavailable = await load();
    await expect(unavailable.SoundHandler.initialize()).resolves.toBeUndefined();
    expect(() => unavailable.SoundHandler.play(Sounds.shoot)).not.toThrow();
  });
});
