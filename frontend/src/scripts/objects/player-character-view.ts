import { vec2 } from 'gl-matrix';
import { Renderer } from 'sdf-2d';
import { Circle, Id, PlayerCharacterBase, UpdateMessage, CharacterTeam } from 'shared';

import { BlobShape } from '../shapes/blob-shape';
import { ViewObject } from './view-object';

export class PlayerCharacterView extends PlayerCharacterBase implements ViewObject {
  private shape: BlobShape;
  private nameElement: HTMLElement;
  private healthElement: HTMLElement;
  private timeSinceLastNameElementUpdate = 0;

  constructor(
    id: Id,
    name: string,
    colorIndex: number,
    team: CharacterTeam,
    health: number,
    head?: Circle,
    leftFoot?: Circle,
    rightFoot?: Circle,
  ) {
    super(id, name, colorIndex, team, health, head, leftFoot, rightFoot);
    this.shape = new BlobShape(colorIndex);

    this.nameElement = document.createElement('div');
    this.nameElement.className = 'player-tag';
    this.nameElement.innerText = this.name;
    this.healthElement = document.createElement('div');
    this.nameElement.appendChild(this.healthElement);
  }

  public get position(): vec2 {
    return this.head!.center;
  }

  public step(deltaTimeInMilliseconds: number): void {
    this.timeSinceLastNameElementUpdate += deltaTimeInMilliseconds;
    this.healthElement.style.width = this.health + '%';
  }

  public beforeDestroy(): void {
    this.nameElement.parentElement?.removeChild(this.nameElement);
  }

  public draw(renderer: Renderer, overlay: HTMLElement): void {
    if (!this.nameElement.parentElement) {
      overlay.appendChild(this.nameElement);
    }

    if (this.timeSinceLastNameElementUpdate > 0.15) {
      const screenPosition = renderer.worldToDisplayCoordinates(
        this.calculateTextPosition(),
      );
      this.nameElement.style.left = screenPosition.x + 'px';
      this.nameElement.style.top = screenPosition.y + 'px';
      this.timeSinceLastNameElementUpdate = 0;
    }

    this.shape.setCircles([this.head!, this.leftFoot!, this.rightFoot!]);
    renderer.addDrawable(this.shape);
  }

  private calculateTextPosition(): vec2 {
    const footAverage = vec2.add(
      vec2.create(),
      this.leftFoot!.center,
      this.rightFoot!.center,
    );
    vec2.scale(footAverage, footAverage, 0.5);

    const headFeetDelta = vec2.subtract(footAverage, this.head!.center, footAverage);
    vec2.normalize(headFeetDelta, headFeetDelta);
    const textOffset = vec2.scale(headFeetDelta, headFeetDelta, this.head!.radius + 50);
    return vec2.add(textOffset, this.head!.center, textOffset);
  }
}
