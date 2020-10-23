import { vec2 } from 'gl-matrix';
import { Renderer } from 'sdf-2d';
import { CommandExecutors, Id, Random, PlanetBase } from 'shared';
import { RenderCommand } from '../commands/types/render';
import { PlanetShape } from '../shapes/planet-shape';
import { ViewObject } from './view-object';

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

  public step(deltaTimeInMilliseconds: number): void {
    this.shape.randomOffset += deltaTimeInMilliseconds / 4000;
    this.shape.colorMixQ = this.ownership;
  }

  private getGradient(): string {
    const sideDecla = this.ownership < 0.5;
    const sidePercent = (Math.abs(this.ownership - 0.5) / 0.5) * 100;
    return sideDecla
      ? `conic-gradient(
      var(--bright-decla) ${sidePercent}%,
      var(--bright-decla) ${sidePercent}%,
      var(--bright-neutral) ${sidePercent}%,
      var(--bright-neutral) 100%
    )`
      : `conic-gradient(
      var(--bright-neutral) 0%,
      var(--bright-neutral) ${100 - sidePercent}%,
      var(--bright-red) ${100 - sidePercent}%,
      var(--bright-red) 100%
    )`;
  }
  public beforeDestroy(): void {
    this.ownershipProgess.parentElement?.removeChild(this.ownershipProgess);
  }

  public draw(renderer: Renderer, overlay: HTMLElement): void {
    if (!this.ownershipProgess.parentElement) {
      overlay.appendChild(this.ownershipProgess);
    }

    const screenPosition = renderer.worldToDisplayCoordinates(this.center);
    this.ownershipProgess.style.left = screenPosition.x + 'px';
    this.ownershipProgess.style.top = screenPosition.y + 'px';
    this.ownershipProgess.style.background = this.getGradient();

    renderer.addDrawable(this.shape);
  }
}
