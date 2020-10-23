import { vec2 } from 'gl-matrix';
import {
  CommandGenerator,
  SecondaryActionCommand,
  TernaryActionCommand,
  MoveActionCommand,
  last,
} from 'shared';
import { Game } from '../../game';
import { OptionsHandler } from '../../options-handler';

export class TouchJoystickListener extends CommandGenerator {
  private joystick: HTMLElement;
  private joystickButton: HTMLElement;

  private isJoystickActive = false;
  private touchStartPosition!: vec2;

  constructor(
    target: HTMLElement,
    private overlay: HTMLElement,
    private readonly game: Game,
  ) {
    super();

    this.joystick = document.createElement('div');
    this.joystick.className = 'joystick';
    this.joystickButton = document.createElement('div');
    this.joystick.appendChild(this.joystickButton);

    target.addEventListener('touchstart', (event: TouchEvent) => {
      event.preventDefault();
      if (this.isJoystickActive) {
        const center = vec2.fromValues(
          last(event.touches)!.clientX,
          last(event.touches)!.clientY,
        );
        this.sendCommandToSubcribers(
          new SecondaryActionCommand(this.game.displayToWorldCoordinates(center)),
        );
      }
    });

    target.addEventListener('touchmove', (event: TouchEvent) => {
      event.preventDefault();

      if (!this.isJoystickActive) {
        this.isJoystickActive = true;
        this.overlay.appendChild(this.joystick);
        this.touchStartPosition = vec2.fromValues(
          event.touches[0].clientX,
          event.touches[0].clientY,
        );
        this.joystickButton.style.transform = `translateX(-50%) translateY(-50%)`;
        this.joystick.style.transform = `translateX(${this.touchStartPosition.x}px) translateY(${this.touchStartPosition.y}px) translateX(-50%) translateY(-50%)`;
      }

      const touchPosition = vec2.fromValues(
        event.touches[0].clientX,
        event.touches[0].clientY,
      );

      const movement = vec2.subtract(
        vec2.create(),
        touchPosition,
        this.touchStartPosition,
      );

      vec2.scale(movement, movement, 1 / 3);
      const length = vec2.length(movement);
      const maxLength = 20;
      vec2.scale(movement, movement, Math.min(1, maxLength / length));
      this.joystickButton.style.transform = `translateX(${movement.x}px) translateY(${movement.y}px) translateX(-50%) translateY(-50%)`;

      vec2.set(movement, movement.x, -movement.y);
      if (vec2.squaredLength(movement) > 0) {
        vec2.normalize(movement, movement);

        this.sendCommandToSubcribers(
          new MoveActionCommand(movement, OptionsHandler.options.relativeMovementEnabled),
        );
      }
    });

    target.addEventListener('touchend', (event: TouchEvent) => {
      event.preventDefault();

      if (!this.isJoystickActive) {
        const center = vec2.fromValues(
          event.changedTouches[0].clientX,
          event.changedTouches[0].clientY,
        );
        this.sendCommandToSubcribers(
          new SecondaryActionCommand(this.game.displayToWorldCoordinates(center)),
        );
      } else if (event.touches.length === 0) {
        this.isJoystickActive = false;
        this.joystick.parentElement?.removeChild(this.joystick);
        this.sendCommandToSubcribers(
          new MoveActionCommand(
            vec2.create(),
            OptionsHandler.options.relativeMovementEnabled,
          ),
        );
      }
    });
  }
}
