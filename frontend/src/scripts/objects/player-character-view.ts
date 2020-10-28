import { vec2 } from 'gl-matrix';
import { Renderer } from 'sdf-2d';
import { Circle, Id, PlayerCharacterBase, CharacterTeam, settings } from 'shared';
import { BlobShape } from '../shapes/blob-shape';
import { SoundHandler, Sounds } from '../sound-handler';
import { VibrationHandler } from '../vibration-handler';
import { ViewObject } from './view-object';

export class PlayerCharacterView extends PlayerCharacterBase implements ViewObject {
  private shape: BlobShape;
  private nameElement: HTMLElement = document.createElement('div');
  private statsElement: HTMLElement = document.createElement('div');
  private healthElement: HTMLElement = document.createElement('div');
  private previousHealth;

  public isMainCharacter = false;

  constructor(
    id: Id,
    name: string,
    killCount: number,
    deathCount: number,
    team: CharacterTeam,
    health: number,
    head?: Circle,
    leftFoot?: Circle,
    rightFoot?: Circle,
  ) {
    super(id, name, killCount, deathCount, team, health, head, leftFoot, rightFoot);
    this.shape = new BlobShape(settings.colorIndices[team]);

    this.previousHealth = this.health;
    this.nameElement.className = 'player-tag ' + this.team;
    this.nameElement.innerText = this.name;
    this.nameElement.appendChild(this.healthElement);
    this.nameElement.appendChild(this.statsElement);
  }

  public get position(): vec2 {
    return this.head!.center;
  }

  public setHealth(health: number) {
    const previousHealth = this.health;
    super.setHealth(health);
    SoundHandler.play(
      Sounds.hit,
      (0.4 * 2 * (previousHealth - health)) / settings.playerMaxStrength,
    );
  }

  public step(deltaTimeInSeconds: number): void {
    if (this.previousHealth > this.health) {
      if (this.isMainCharacter) {
        VibrationHandler.vibrate(Math.min(200, (this.previousHealth - this.health) * 4));
      }

      this.previousHealth = this.health;
    }
  }

  public onShoot(strength: number) {
    SoundHandler.play(Sounds.shoot, (0.3 * 2 * strength) / settings.playerMaxStrength);
  }

  public beforeDestroy(): void {
    this.nameElement.parentElement?.removeChild(this.nameElement);
  }

  public draw(
    renderer: Renderer,
    overlay: HTMLElement,
    shouldChangeLayout: boolean,
  ): void {
    if (shouldChangeLayout) {
      if (!this.nameElement.parentElement) {
        overlay.appendChild(this.nameElement);
      }

      const screenPosition = renderer.worldToDisplayCoordinates(
        this.calculateTextPosition(),
      );

      this.nameElement.style.transform = `translateX(${screenPosition.x}px) translateY(${screenPosition.y}px) translateX(-50%) translateY(-50%) rotate(-15deg)`;

      this.healthElement.style.width =
        (50 * this.health) / settings.playerMaxHealth + 'px';
      this.statsElement.innerText = this.getStatsText();
    }

    this.shape.setCircles([this.head!, this.leftFoot!, this.rightFoot!]);
    renderer.addDrawable(this.shape);
  }

  private getStatsText(): string {
    return `${this.killCount}⚔/${this.deathCount}☠`;
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
    const textOffset = vec2.scale(headFeetDelta, headFeetDelta, this.head!.radius + 80);
    return vec2.add(textOffset, this.head!.center, textOffset);
  }
}
