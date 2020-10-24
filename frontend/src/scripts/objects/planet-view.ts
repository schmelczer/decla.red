import { vec2 } from 'gl-matrix';
import { Renderer } from 'sdf-2d';
import { CommandExecutors, Id, Random, PlanetBase } from 'shared';
import { RenderCommand } from '../commands/types/render';
import { PlanetShape } from '../shapes/planet-shape';
import { ViewObject } from './view-object';

type FallingPoint = {
  velocity: vec2;
  position: vec2;
  element: HTMLElement;
  addedToOverlay: boolean;
  timeToLive: number;
};

export class PlanetView extends PlanetBase implements ViewObject {
  private shape: PlanetShape;
  private ownershipProgess: HTMLElement;

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: (c: RenderCommand) => c.renderer.addDrawable(this.shape),
  };

  constructor(id: Id, vertices: Array<vec2>, ownership: number) {
    super(id, vertices);
    this.shape = new PlanetShape(vertices, ownership);
    (this.shape as any).randomOffset = Random.getRandom();

    this.ownershipProgess = document.createElement('div');
    this.ownershipProgess.className = 'ownership';
  }

  public step(deltaTimeInSeconds: number): void {
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

      if ((p.timeToLive -= deltaTimeInSeconds) <= 0) {
        p.element.parentElement?.removeChild(p.element);
      } else {
        p.element.style.opacity = Math.min(1, p.timeToLive).toString();
      }
    });

    this.generatedPointElements = this.generatedPointElements.filter(
      (p) => p.timeToLive > 0,
    );
  }

  private generatedPointElements: Array<FallingPoint> = [];

  public generatedPoints(value: number) {
    const element = document.createElement('div');
    element.className = 'falling-point ' + (this.ownership < 0.5 ? 'decla' : 'red');
    element.innerText = '+' + value;
    this.generatedPointElements.push({
      element,
      addedToOverlay: false,
      timeToLive: Random.getRandomInRange(2, 3),
      position: vec2.create(),
      velocity: vec2.fromValues(Random.getRandomInRange(-30, 30), 0),
    });
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
  public beforeDestroy(): void {
    this.ownershipProgess.parentElement?.removeChild(this.ownershipProgess);
    this.generatedPointElements.forEach((p) =>
      p.element.parentElement?.removeChild(p.element),
    );
  }

  public draw(renderer: Renderer, overlay: HTMLElement): void {
    if (!this.ownershipProgess.parentElement) {
      overlay.appendChild(this.ownershipProgess);
    }

    const screenPosition = renderer.worldToDisplayCoordinates(this.center);

    this.generatedPointElements.forEach((p) => {
      if (!p.addedToOverlay) {
        overlay.appendChild(p.element);
      }

      p.element.style.left = screenPosition.x + p.position.x + 'px';
      p.element.style.top = screenPosition.y + p.position.y + 'px';
    });

    this.ownershipProgess.style.left = screenPosition.x + 'px';
    this.ownershipProgess.style.top = screenPosition.y + 'px';
    this.ownershipProgess.style.background = this.getGradient();

    renderer.addDrawable(this.shape);
  }
}
