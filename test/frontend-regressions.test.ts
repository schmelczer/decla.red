import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KeyboardListener } from '../frontend/src/scripts/commands/keyboard-listener';
import { TouchListener } from '../frontend/src/scripts/commands/touch-listener';
import { JoinFormHandler } from '../frontend/src/scripts/join-form-handler';
import { initializeOptions, options } from '../frontend/src/scripts/options-handler';
import { loadStoredValue, saveStoredValue } from '../frontend/src/scripts/helper/storage';
import { ChargeIndicator } from '../frontend/src/scripts/charge-indicator';
import { localCharacterPredictor } from '../frontend/src/scripts/helper/prediction/local-character-predictor';

const { connect } = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock('../frontend/node_modules/socket.io-client/build/esm-debug/index.js', () => ({
  io: connect,
}));
vi.mock('../frontend/src/scripts/configuration', () => ({
  servers: ['https://first.test', 'https://second.test'],
}));
vi.mock('../frontend/src/scripts/sound-handler', () => ({
  Sounds: { click: 'click' },
  SoundHandler: { play: vi.fn(), playAmbient: vi.fn(), stopAmbient: vi.fn() },
}));
vi.mock('../frontend/src/scripts/charge-indicator', () => ({
  ChargeIndicator: { begin: vi.fn(), end: vi.fn() },
}));

// Only the DOM operations exercised by the chooser and input listeners are needed.
class Element extends EventTarget {
  public children: Element[] = [];
  public parentElement?: Element;
  public style: Record<string, string> = {};
  public className = '';
  public checked = false;
  public disabled = false;
  public hidden = false;
  private attributes = new Map<string, string>();
  public onsubmit: ((event: Event) => void) | null = null;

  public setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  public getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  public appendChild(child: Element) {
    child.remove();
    this.children.push(child);
    child.parentElement = this;
  }
  public append(...children: Element[]) {
    children.forEach((child) => this.appendChild(child));
  }
  public remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
      this.parentElement = undefined;
    }
  }
  public querySelector() {
    return this.children[0];
  }
  public getBoundingClientRect() {
    return { left: 0, top: 0, width: 100, height: 100 };
  }
}

class Socket extends EventEmitter {
  public io = new EventEmitter();
  public close = vi.fn();
}

const dispatch = (target: EventTarget, type: string, fields = {}) => {
  const event = Object.assign(new Event(type, { cancelable: true }), fields);
  target.dispatchEvent(event);
  return event;
};
const touch = (identifier: number, clientX = 50, clientY = 50) => ({
  identifier,
  clientX,
  clientY,
});
const touchEvent = (
  target: EventTarget,
  type: string,
  changedTouches: unknown[],
  touches = changedTouches,
) => dispatch(target, type, { changedTouches, touches });

let windowTarget: EventTarget;
let sockets: Socket[];

beforeEach(() => {
  vi.useFakeTimers();
  localCharacterPredictor.reset();
  windowTarget = new EventTarget();
  sockets = [];
  vi.stubGlobal('window', windowTarget);
  vi.stubGlobal('addEventListener', windowTarget.addEventListener.bind(windowTarget));
  vi.stubGlobal(
    'removeEventListener',
    windowTarget.removeEventListener.bind(windowTarget),
  );
  vi.stubGlobal('document', { createElement: () => new Element() });
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
  connect.mockImplementation(() => {
    const socket = new Socket();
    sockets.push(socket);
    return socket;
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const chooser = () => {
  const form = new Element();
  form.appendChild(new Element());
  const container = new Element();
  const handler = new JoinFormHandler(form as never, container as never);
  return { form, container, handler };
};
const serverInfo = {
  serverName: 'test',
  playerCount: 1,
  playerLimit: 8,
  gameStatePercent: 20,
};

describe('server chooser lifecycle', () => {
  it('aborts discovery and ignores responses completing after the chooser closes', async () => {
    const signals: AbortSignal[] = [];
    let resolveBody!: (value: unknown) => void;
    const body = new Promise((resolve) => {
      resolveBody = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, { signal }) => {
        signals.push(signal);
        return Promise.resolve({ ok: true, json: () => body });
      }),
    );
    const { form, container, handler } = chooser();
    await Promise.resolve();
    handler.destroy();
    resolveBody(serverInfo);
    await vi.runAllTimersAsync();

    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(sockets).toHaveLength(0);
    expect(container.children).toHaveLength(0);
    expect(form.onsubmit).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('selects a remaining server when the selected connection fails and removes listeners on exit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => serverInfo })),
    );
    const { form, container, handler } = chooser();
    await vi.advanceTimersByTimeAsync(0);
    expect(container.children).toHaveLength(2);
    expect(container.children[0].children[0].checked).toBe(true);
    expect(container.children[1].children[0].checked).toBe(false);

    sockets[0].io.emit('reconnect_failed');
    expect(container.children).toHaveLength(1);
    expect(container.children[0].children[0].checked).toBe(true);
    expect(form.children[0].disabled).toBe(false);

    handler.destroy();
    expect(
      sockets.every((socket) => socket.io.listenerCount('reconnect_failed') === 0),
    ).toBe(true);
    expect(container.children).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('movement input', () => {
  it('ignores unrelated keys, prevents browser movement defaults, and resends held keys after respawn', () => {
    const send = vi.fn();
    const listener = new KeyboardListener(send);
    dispatch(windowTarget, 'keydown', { code: 'KeyP' });
    expect(send).not.toHaveBeenCalled();
    const key = dispatch(windowTarget, 'keydown', { code: 'ArrowRight' });
    expect(key.defaultPrevented).toBe(true);
    expect(send.mock.lastCall?.[0].direction).toEqual([1, 0]);
    listener.resendMovement();
    expect(send).toHaveBeenCalledTimes(2);
    dispatch(windowTarget, 'blur');
    expect(send.mock.lastCall?.[0].direction).toEqual([0, 0]);
    listener.resendMovement();
    expect(send).toHaveBeenCalledTimes(3);
    listener.destroy();
  });
});

const touchControls = () => {
  const canvas = new Element();
  const overlay = new Element();
  const send = vi.fn();
  const character = {
    health: 100,
    bodyCenter: [0, 0],
    facingDirection: [1, 0],
    strengthFraction: 1,
  };
  const game = {
    displayToWorldCoordinates: (position: number[]) => position,
    gameObjects: {
      localPlayer: character as typeof character | undefined,
    },
  };
  const listener = new TouchListener(
    canvas as never,
    overlay as never,
    game as never,
    send,
  );
  listener.update();
  return {
    canvas,
    overlay,
    send,
    listener,
    game,
    character,
    fire: overlay.children[0],
    leap: overlay.children[1],
  };
};

describe('touch action availability', () => {
  it('cancels a held shot on death and requires a fresh press after respawn', () => {
    const { fire, send, listener, game, character } = touchControls();
    touchEvent(fire, 'touchstart', [touch(1)]);
    touchEvent(fire, 'touchmove', [touch(1, 100, 50)]);
    expect(fire.children[1].style.opacity).toBe('1');

    character.health = 0;
    listener.update();
    expect(fire.getAttribute('aria-disabled')).toBe('true');
    expect(fire.children[1].style.opacity).toBe('0');
    expect(ChargeIndicator.end).toHaveBeenCalled();
    vi.mocked(ChargeIndicator.begin).mockClear();
    touchEvent(fire, 'touchstart', [touch(2)]);
    touchEvent(fire, 'touchend', [touch(2)], []);
    expect(ChargeIndicator.begin).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();

    game.gameObjects.localPlayer = undefined;
    listener.update();
    touchEvent(fire, 'touchstart', [touch(3)]);
    touchEvent(fire, 'touchend', [touch(3)], []);
    expect(send).not.toHaveBeenCalled();

    game.gameObjects.localPlayer = { ...character, health: 100 };
    listener.update();
    expect(fire.getAttribute('aria-disabled')).toBe('false');
    touchEvent(fire, 'touchend', [touch(1)], []);
    expect(send).not.toHaveBeenCalled();
    touchEvent(fire, 'touchstart', [touch(4)]);
    touchEvent(fire, 'touchend', [touch(4)], []);
    expect(send).toHaveBeenCalledTimes(1);
    listener.destroy();
  });

  it('rejects a shot released after death before the controls update', () => {
    const { fire, send, listener, character } = touchControls();
    touchEvent(fire, 'touchstart', [touch(1)]);
    character.health = 0;
    touchEvent(fire, 'touchend', [touch(1)], []);
    expect(send).not.toHaveBeenCalled();
    listener.destroy();
  });

  it('only shows and accepts jumps while the living player can leap', () => {
    const canLeap = vi.spyOn(localCharacterPredictor, 'canLeap', 'get');
    canLeap.mockReturnValue(false);
    const { leap, send, listener, character } = touchControls();
    expect(leap.hidden).toBe(true);
    touchEvent(leap, 'touchstart', [touch(1)]);
    expect(send).not.toHaveBeenCalled();

    canLeap.mockReturnValue(true);
    listener.update();
    expect(leap.hidden).toBe(false);
    touchEvent(leap, 'touchstart', [touch(2)]);
    expect(send.mock.lastCall?.[0].constructor.name).toBe('LeapActionCommand');
    expect(leap.hidden).toBe(true);

    character.health = 0;
    listener.update();
    expect(leap.hidden).toBe(true);
    touchEvent(leap, 'touchstart', [touch(3)]);
    expect(send).toHaveBeenCalledTimes(1);
    listener.destroy();
  });
});

describe('touch ownership', () => {
  it('keeps the first canvas gesture when a second finger lands before dragging', () => {
    const { canvas, send, listener } = touchControls();
    touchEvent(canvas, 'touchstart', [touch(1, 10, 20)]);
    touchEvent(
      canvas,
      'touchstart',
      [touch(2, 80, 90)],
      [touch(1, 10, 20), touch(2, 80, 90)],
    );
    touchEvent(canvas, 'touchend', [touch(2, 80, 90)], [touch(1, 10, 20)]);
    expect(send).not.toHaveBeenCalled();
    touchEvent(canvas, 'touchend', [touch(1, 10, 20)], []);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.lastCall?.[0].constructor.name).toBe('PrimaryActionCommand');
    listener.destroy();
  });

  it('does not fire when a charge is cancelled or another finger releases', () => {
    const { fire, send, listener } = touchControls();
    touchEvent(fire, 'touchstart', [touch(1)]);
    touchEvent(fire, 'touchstart', [touch(2)]);
    touchEvent(fire, 'touchend', [touch(2)], [touch(1)]);
    expect(send).not.toHaveBeenCalled();
    touchEvent(fire, 'touchcancel', [touch(1)], []);
    touchEvent(fire, 'touchend', [touch(1)], []);
    expect(send).not.toHaveBeenCalled();
    touchEvent(fire, 'touchstart', [touch(3)]);
    touchEvent(fire, 'touchend', [touch(3)], []);
    expect(send).toHaveBeenCalledTimes(1);
    listener.destroy();
  });

  it('resends a held joystick after respawn and stops movement when focus is lost', () => {
    const { canvas, overlay, send, listener } = touchControls();
    touchEvent(canvas, 'touchstart', [touch(1)]);
    touchEvent(canvas, 'touchmove', [touch(1, 100, 50)]);
    listener.resendMovement();
    expect(send.mock.lastCall?.[0].direction[0]).toBe(1);
    expect(send.mock.lastCall?.[0].direction[1]).toBeCloseTo(0);
    dispatch(windowTarget, 'blur');
    expect(send.mock.lastCall?.[0].direction).toEqual([0, 0]);
    expect(overlay.children).toHaveLength(2);
    touchEvent(canvas, 'touchstart', [touch(2)]);
    touchEvent(canvas, 'touchmove', [touch(2, 100, 50)]);
    listener.destroy();
    expect(overlay.children).toHaveLength(0);
  });
});

describe('stored preferences', () => {
  it('ignores corrupt JSON and unavailable storage', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('{');
    expect(loadStoredValue('userName')).toBeUndefined();
    vi.mocked(localStorage.getItem).mockImplementation(() => {
      throw new Error('disabled');
    });
    vi.mocked(localStorage.setItem).mockImplementation(() => {
      throw new Error('disabled');
    });
    expect(loadStoredValue('options')).toBeUndefined();
    expect(() => saveStoredValue('userName', 'player')).not.toThrow();
  });

  it('only loads boolean options that the game recognizes', () => {
    Object.assign(options, {
      soundsEnabled: true,
      musicEnabled: true,
      vibrationEnabled: true,
    });
    vi.mocked(localStorage.getItem).mockReturnValue(
      JSON.stringify({
        soundsEnabled: 'false',
        musicEnabled: false,
        vibrationEnabled: null,
        extra: true,
      }),
    );
    initializeOptions({
      soundsEnabled: new Element(),
      musicEnabled: new Element(),
      vibrationEnabled: new Element(),
    } as never);
    expect(options).toEqual({
      soundsEnabled: true,
      musicEnabled: false,
      vibrationEnabled: true,
    });
  });
});
