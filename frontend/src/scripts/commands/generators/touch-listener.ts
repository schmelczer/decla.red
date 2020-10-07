import { vec2 } from 'gl-matrix';
import {
  CommandGenerator,
  PrimaryActionCommand,
  SecondaryActionCommand,
  TernaryActionCommand,
  MoveActionCommand,
} from 'shared';

export class TouchListener extends CommandGenerator {
  private previousPosition = vec2.create();
  private currentPosition = vec2.create();

  private previousDeltas: Array<vec2> = [];

  constructor(target: HTMLElement) {
    super();

    target.addEventListener('touchstart', (event: TouchEvent) => {
      event.preventDefault();

      const touchCount = event.touches.length;
      const position = this.positionFromEvent(event);
      this.previousPosition = position;
      this.currentPosition = position;

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
      this.previousDeltas.push(
        vec2.subtract(vec2.create(), position, this.previousPosition),
      );
      this.currentPosition = position;
    });
  }

  public generateCommands() {
    const movement = vec2.subtract(
      vec2.create(),
      this.currentPosition,
      this.previousPosition,
    );
    this.previousPosition = this.currentPosition;
    if (vec2.squaredLength(movement) > 0) {
      vec2.normalize(movement, movement);
      this.sendCommandToSubcribers(new MoveActionCommand(movement));
    }
  }

  private positionFromEvent(event: TouchEvent): vec2 {
    const touches = Array.prototype.slice.call(event.touches);
    const center = touches.reduce(
      (center: vec2, touch: Touch) =>
        vec2.add(center, center, vec2.fromValues(-touch.clientX, touch.clientY)),
      vec2.create(),
    );

    return vec2.scale(center, center, 1 / event.touches.length);
  }
}
