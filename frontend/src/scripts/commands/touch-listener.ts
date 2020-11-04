import { vec2 } from 'gl-matrix';
import {
  CommandGenerator,
  SecondaryActionCommand,
  MoveActionCommand,
  last,
} from 'shared';
import { Game } from '../game';

export class TouchListener extends CommandGenerator {
  private static readonly deadZone = 8;
  private static readonly deltaScaling = 0.4;

  private joystick: HTMLElement;
  private joystickButton: HTMLElement;
  private isJoystickActive = false;
  private touchStartPosition!: vec2;

  constructor(private overlay: HTMLElement, private readonly game: Game) {
    super();

    this.joystick = document.createElement('div');
    this.joystick.className = 'joystick';
    this.joystickButton = document.createElement('div');
    this.joystick.appendChild(this.joystickButton);

    addEventListener('touchstart', this.touchStartListener);
    addEventListener('touchmove', this.touchMoveListener);
    addEventListener('touchend', this.touchEndListener);
  }

  private touchStartListener = (event: TouchEvent) => {
    event.preventDefault();
    if (this.isJoystickActive) {
      const center = vec2.fromValues(
        last(event.touches)!.clientX,
        last(event.touches)!.clientY,
      );
      this.sendCommandToSubscribers(
        new SecondaryActionCommand(this.game.displayToWorldCoordinates(center)),
      );
    } else {
      this.touchStartPosition = vec2.fromValues(
        event.touches[0].clientX,
        event.touches[0].clientY,
      );
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
      this.overlay.appendChild(this.joystick);
      this.joystickButton.style.transform = `translateX(-50%) translateY(-50%)`;
      this.joystick.style.transform = `translateX(${this.touchStartPosition.x}px) translateY(${this.touchStartPosition.y}px) translateX(-50%) translateY(-50%)`;
    }

    const maxLength = 20;
    vec2.scale(delta, delta, Math.min(1, maxLength / deltaLength));
    this.joystickButton.style.transform = `translateX(${delta.x}px) translateY(${delta.y}px) translateX(-50%) translateY(-50%)`;

    vec2.set(delta, delta.x, -delta.y);
    if (deltaLength > TouchListener.deadZone) {
      this.sendCommandToSubscribers(new MoveActionCommand(vec2.normalize(delta, delta)));
    } else {
      this.sendCommandToSubscribers(new MoveActionCommand(vec2.create()));
    }
  };

  private touchEndListener = (event: TouchEvent) => {
    event.preventDefault();

    if (!this.isJoystickActive) {
      const center = vec2.fromValues(
        event.changedTouches[0].clientX,
        event.changedTouches[0].clientY,
      );
      this.sendCommandToSubscribers(
        new SecondaryActionCommand(this.game.displayToWorldCoordinates(center)),
      );
    } else if (event.touches.length === 0) {
      this.isJoystickActive = false;
      this.joystick.parentElement?.removeChild(this.joystick);
      this.sendCommandToSubscribers(new MoveActionCommand(vec2.create()));
    }
  };

  public destroy() {
    removeEventListener('touchstart', this.touchStartListener);
    removeEventListener('touchmove', this.touchMoveListener);
    removeEventListener('touchend', this.touchEndListener);
  }
}
