import { vec2 } from 'gl-matrix';
import { Id, Random, PlanetBase, UpdatePropertyCommand, CommandExecutors } from 'shared';
import { BeforeDestroyCommand } from '../../commands/types/before-destroy';
import { RenderCommand } from '../../commands/types/render';
import { StepCommand } from '../../commands/types/step';
import { PlanetShape } from '../../shapes/planet-shape';

type FallingPoint = {
  velocity: vec2;
  position: vec2;
  element: HTMLElement;
  addedToOverlay: boolean;
  timeToLive: number;
};

export class PlanetView extends PlanetBase {
  private shape: PlanetShape;
  private ownershipProgress: HTMLElement;

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: this.draw.bind(this),
    [StepCommand.type]: this.step.bind(this),
    [BeforeDestroyCommand.type]: this.beforeDestroy.bind(this),
    [UpdatePropertyCommand.type]: this.updateProperty.bind(this),
  };

  constructor(id: Id, vertices: Array<vec2>, ownership: number) {
    super(id, vertices);
    this.shape = new PlanetShape(vertices, ownership);
    (this.shape as any).randomOffset = Random.getRandom();

    this.ownershipProgress = document.createElement('div');
    this.ownershipProgress.className = 'ownership';
  }

  private step(deltaTimeInSeconds: number): void {
    this.shape.randomOffset += deltaTimeInSeconds / 4;
    this.shape.colorMixQ = this.ownership;

    this.generatedPointElements.forEach((p) => {
      vec2.add(
        p.velocity,
        p.velocity,
        vec2.scale(vec2.create(), vec2.fromValues(0, 50), deltaTimeInSeconds),
      );

      vec2.add(
        p.position,
        p.position,
        vec2.scale(vec2.create(), p.velocity, deltaTimeInSeconds),
      );

      p.timeToLive -= deltaTimeInSeconds;
    });
  }

  private generatedPointElements: Array<FallingPoint> = [];

  private lastGeneratedPoint?: number;
  public generatedPoints(value: number) {
    this.lastGeneratedPoint = value;
  }

  private beforeDestroy(): void {
    this.ownershipProgress.parentElement?.removeChild(this.ownershipProgress);
    this.generatedPointElements.forEach((p) =>
      p.element.parentElement?.removeChild(p.element),
    );
  }

  private updateProperty({ propertyValue }: UpdatePropertyCommand): void {
    this.ownership = propertyValue;
  }

  private draw({ renderer, overlay, shouldChangeLayout }: RenderCommand): void {
    if (shouldChangeLayout) {
      if (!this.ownershipProgress.parentElement) {
        overlay.appendChild(this.ownershipProgress);
      }

      const screenPosition = renderer.worldToDisplayCoordinates(this.center);

      this.generatedPointElements.forEach((p) => {
        if (!p.addedToOverlay) {
          overlay.appendChild(p.element);
        }

        p.element.style.transform = `translateX(${
          screenPosition.x + p.position.x
        }px) translateY(${screenPosition.y + p.position.y}px)`;

        if (p.timeToLive <= 0) {
          p.element.parentElement?.removeChild(p.element);
        } else {
          p.element.style.opacity = Math.min(1, p.timeToLive).toString();
        }
      });

      this.generatedPointElements = this.generatedPointElements.filter(
        (p) => p.timeToLive > 0,
      );

      this.ownershipProgress.style.transform = `translateX(${screenPosition.x}px) translateY(${screenPosition.y}px) translateX(-50%) translateY(-50%)`;
      this.ownershipProgress.style.background = this.getGradient();

      if (this.lastGeneratedPoint !== undefined) {
        const element = document.createElement('div');
        element.className = 'falling-point ' + (this.ownership < 0.5 ? 'decla' : 'red');
        element.innerText = '+' + this.lastGeneratedPoint;
        this.generatedPointElements.push({
          element,
          addedToOverlay: false,
          timeToLive: Random.getRandomInRange(2, 3),
          position: vec2.create(),
          velocity: vec2.fromValues(Random.getRandomInRange(-30, 30), 0),
        });

        this.lastGeneratedPoint = undefined;
      }
    }

    renderer.addDrawable(this.shape);
  }

  private getGradient(): string {
    const sideDecla = this.ownership < 0.5;
    const sidePercent = (Math.abs(this.ownership - 0.5) / 0.5) * 100;
    return sideDecla
      ? `conic-gradient(
      var(--bright-decla) ${sidePercent}%,
      var(--bright-decla) ${sidePercent}%,
      rgba(0, 0, 0, 0) ${sidePercent}%,
      rgba(0, 0, 0, 0) 100%
    )`
      : `conic-gradient(
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 0) ${100 - sidePercent}%,
      var(--bright-red) ${100 - sidePercent}%,
      var(--bright-red) 100%
    )`;
  }
}
