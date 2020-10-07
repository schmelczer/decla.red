import { vec2 } from 'gl-matrix';
import {
  CommandGenerator,
  MoveActionCommand,
  PrimaryActionCommand,
  SecondaryActionCommand,
  TernaryActionCommand,
} from 'shared';

export class TouchListener extends CommandGenerator {
  private previousPosition = vec2.create();

  constructor(target: HTMLElement) {
    super();

    target.addEventListener('touchstart', (event: TouchEvent) => {
      event.preventDefault();

      const touchCount = event.touches.length;
      const position = this.positionFromEvent(event);
      this.previousPosition = position;

      if (touchCount == 1) {
        this.sendCommandToSubcribers(new PrimaryActionCommand(position));
      } else if (touchCount == 2) {
        this.sendCommandToSubcribers(new SecondaryActionCommand(position));
      } else {
        this.sendCommandToSubcribers(new TernaryActionCommand(position));
      }
    });

    target.addEventListener('touchmove', (event: TouchEvent) => {
      event.preventDefault();

      const position = this.positionFromEvent(event);

      this.sendCommandToSubcribers(
        new MoveActionCommand(
          vec2.subtract(vec2.create(), position, this.previousPosition),
        ),
      );

      this.previousPosition = position;
    });
  }

  private positionFromEvent(event: TouchEvent): vec2 {
    const center = Array.prototype.reduce.call(
      event.touches,
      (center: vec2, touch: Touch) =>
        vec2.add(center, center, vec2.fromValues(-touch.clientX, touch.clientY)),
      vec2.create(),
    );

    return vec2.scale(center, center, 1 / event.touches.length);
  }
}
