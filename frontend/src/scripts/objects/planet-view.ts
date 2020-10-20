import { vec2 } from 'gl-matrix';
import { Drawable, Renderer } from 'sdf-2d';
import {
  CommandExecutors,
  Id,
  Random,
  PlanetBase,
  UpdateMessage,
  settings,
} from 'shared';
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
    let teamName = 'Neutral';
    if (this.ownership < 0.5 - settings.planetControlThreshold) {
      teamName = 'Decla';
    } else if (this.ownership > 0.5 + settings.planetControlThreshold) {
      teamName = 'Red';
    }

    this.ownershipProgess.innerText = `${teamName} ${Math.round(
      (Math.abs(this.ownership - 0.5) / 0.5) * 100,
    )}%`;
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

    renderer.addDrawable(this.shape);
  }
}
