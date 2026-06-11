import { vec2 } from 'gl-matrix';
import {
  CommandGenerator,
  MoveActionCommand,
  last,
  PrimaryActionCommand,
  holdDurationToCharge,
  settings,
} from 'shared';
import { Game } from '../game';
import { ChargeIndicator } from '../charge-indicator';

export class TouchListener extends CommandGenerator {
  private static readonly deadZone = 8;
  private static readonly deltaScaling = 0.4;

  private joystick: HTMLElement;
  private joystickButton: HTMLElement;
  private isJoystickActive = false;
  private touchStartPosition!: vec2;
  private primaryDownAt: number | null = null;

  private fireButton: HTMLElement;
  private fireStrengthRing: HTMLElement;

  private fireDownAt: number | null = null;

  constructor(
    private target: HTMLElement,
    private overlay: HTMLElement,
    private readonly game: Game,
  ) {
    super();

    this.joystick = document.createElement('div');
    this.joystick.className = 'joystick';
    this.joystickButton = document.createElement('div');
    this.joystick.appendChild(this.joystickButton);

    this.fireButton = document.createElement('div');
    this.fireButton.className = 'touch-button fire';
    this.fireStrengthRing = document.createElement('div');
    this.fireStrengthRing.className = 'strength-ring';
    this.fireButton.appendChild(this.fireStrengthRing);

    this.fireButton.addEventListener('touchstart', this.fireButtonDownListener);
    this.fireButton.addEventListener('touchend', this.fireButtonUpListener);

    this.overlay.appendChild(this.fireButton);

    target.addEventListener('touchstart', this.touchStartListener);
    target.addEventListener('touchmove', this.touchMoveListener);
    target.addEventListener('touchend', this.touchEndListener);
  }

  private touchStartListener = (event: TouchEvent) => {
    event.preventDefault();
    if (this.isJoystickActive) {
      const center = vec2.fromValues(
        last(event.touches)!.clientX,
        last(event.touches)!.clientY,
      );
      this.sendCommandToSubscribers(
        new PrimaryActionCommand(this.game.displayToWorldCoordinates(center)),
      );
    } else {
      this.touchStartPosition = vec2.fromValues(
        event.touches[0].clientX,
        event.touches[0].clientY,
      );
      this.primaryDownAt = performance.now();
      ChargeIndicator.begin(this.touchStartPosition.x, this.touchStartPosition.y);
    }
  };

  private touchMoveListener = (event: TouchEvent) => {
    event.preventDefault();

    const touchPosition = vec2.fromValues(
      event.touches[0].clientX,
      event.touches[0].clientY,
    );

    const delta = vec2.subtract(vec2.create(), touchPosition, this.touchStartPosition);
    vec2.scale(delta, delta, TouchListener.deltaScaling);
    const deltaLength = vec2.length(delta);

    if (!this.isJoystickActive && deltaLength > TouchListener.deadZone) {
      this.isJoystickActive = true;
      this.primaryDownAt = null;
      ChargeIndicator.end();
      this.overlay.appendChild(this.joystick);
      this.joystickButton.style.transform = `translateX(-50%) translateY(-50%)`;
      this.joystick.style.transform = `translateX(${this.touchStartPosition.x}px) translateY(${this.touchStartPosition.y}px) translateX(-50%) translateY(-50%)`;
    }

    const maxLength = 20;
    vec2.scale(delta, delta, Math.min(1, maxLength / deltaLength));
    this.joystickButton.style.transform = `translateX(${delta.x}px) translateY(${delta.y}px) translateX(-50%) translateY(-50%)`;

    vec2.set(delta, delta.x, -delta.y);
    if (deltaLength > TouchListener.deadZone) {
      const direction = vec2.normalize(delta, delta);
      this.sendCommandToSubscribers(new MoveActionCommand(direction));
    } else {
      this.sendCommandToSubscribers(new MoveActionCommand(vec2.create()));
    }
  };

  private touchEndListener = (event: TouchEvent) => {
    event.preventDefault();

    if (!this.isJoystickActive) {
      ChargeIndicator.end();
      const charge =
        this.primaryDownAt === null
          ? 0
          : holdDurationToCharge((performance.now() - this.primaryDownAt) / 1000);
      this.primaryDownAt = null;
      const center = vec2.fromValues(
        event.changedTouches[0].clientX,
        event.changedTouches[0].clientY,
      );
      this.sendCommandToSubscribers(
        new PrimaryActionCommand(this.game.displayToWorldCoordinates(center), charge),
      );
    } else if (event.touches.length === 0) {
      this.isJoystickActive = false;
      this.joystick.parentElement?.removeChild(this.joystick);
      this.sendCommandToSubscribers(new MoveActionCommand(vec2.create()));
    }
  };

  private swallowTouch = (event: TouchEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  private fireButtonDownListener = (event: TouchEvent) => {
    this.swallowTouch(event);
    this.fireDownAt = performance.now();
    const rect = this.fireButton.getBoundingClientRect();
    ChargeIndicator.begin(rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  private fireButtonUpListener = (event: TouchEvent) => {
    this.swallowTouch(event);
    ChargeIndicator.end();
    if (this.fireDownAt === null) {
      return;
    }

    const charge = holdDurationToCharge((performance.now() - this.fireDownAt) / 1000);
    this.fireDownAt = null;

    const character = this.game.gameObjects.player;
    if (!character) {
      return;
    }
    const aim = vec2.scaleAndAdd(
      vec2.create(),
      character.bodyCenter,
      character.facingDirection,
      settings.touchAimRange,
    );
    this.sendCommandToSubscribers(new PrimaryActionCommand(aim, charge));
  };

  public update(_deltaTimeInSeconds: number) {
    if (!this.fireButton.parentElement) {
      this.overlay.appendChild(this.fireButton);
    }

    const character = this.game.gameObjects.player;
    if (character) {
      this.fireStrengthRing.style.background = `conic-gradient(rgba(255, 255, 255, 0.75) ${character.strengthFraction * 360
        }deg, transparent 0deg)`;
    }
  }

  public destroy() {
    ChargeIndicator.end();
    this.target.removeEventListener('touchstart', this.touchStartListener);
    this.target.removeEventListener('touchmove', this.touchMoveListener);
    this.target.removeEventListener('touchend', this.touchEndListener);

    this.fireButton.removeEventListener('touchstart', this.fireButtonDownListener);
    this.fireButton.removeEventListener('touchend', this.fireButtonUpListener);

    this.fireButton.parentElement?.removeChild(this.fireButton);
  }
}
