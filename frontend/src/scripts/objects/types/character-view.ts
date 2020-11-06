import { vec2 } from 'gl-matrix';
import { Renderer } from 'sdf-2d';
import {
  Circle,
  Id,
  CharacterBase,
  CharacterTeam,
  settings,
  CommandExecutors,
  UpdatePropertyCommand,
} from 'shared';
import { BeforeDestroyCommand } from '../../commands/types/before-destroy';
import { RenderCommand } from '../../commands/types/render';
import { StepCommand } from '../../commands/types/step';
import { CircleExtrapolator } from '../../helper/circle-extrapolator';
import { BlobShape } from '../../shapes/blob-shape';
import { SoundHandler, Sounds } from '../../sound-handler';
import { VibrationHandler } from '../../vibration-handler';

export class CharacterView extends CharacterBase {
  private shape: BlobShape;
  private nameElement: HTMLElement = document.createElement('div');
  private statsElement: HTMLElement = document.createElement('div');
  private healthElement: HTMLElement = document.createElement('div');

  public isMainCharacter = false;

  private leftFootExtrapolator: CircleExtrapolator;
  private rightFootExtrapolator: CircleExtrapolator;
  private headExtrapolator: CircleExtrapolator;

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: this.draw.bind(this),
    [StepCommand.type]: this.step.bind(this),
    [BeforeDestroyCommand.type]: this.beforeDestroy.bind(this),
    [UpdatePropertyCommand.type]: this.updateProperty.bind(this),
  };

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

    this.leftFootExtrapolator = new CircleExtrapolator(this.leftFoot!);
    this.rightFootExtrapolator = new CircleExtrapolator(this.rightFoot!);
    this.headExtrapolator = new CircleExtrapolator(this.head!);

    this.nameElement.className = 'player-tag ' + this.team;
    this.nameElement.innerText = this.name;
    this.nameElement.appendChild(this.healthElement);
    this.nameElement.appendChild(this.statsElement);
  }

  public get position(): vec2 {
    return this.head!.center;
  }

  private updateProperty({
    propertyKey,
    propertyValue,
    rateOfChange,
  }: UpdatePropertyCommand) {
    if (propertyKey === 'head') {
      this.headExtrapolator.addFrame(propertyValue, rateOfChange);
    }
    if (propertyKey === 'leftFoot') {
      this.leftFootExtrapolator.addFrame(propertyValue, rateOfChange);
    }
    if (propertyKey === 'rightFoot') {
      this.rightFootExtrapolator.addFrame(propertyValue, rateOfChange);
    }
  }

  public setHealth(health: number) {
    const previousHealth = this.health;
    super.setHealth(health);
    SoundHandler.play(
      Sounds.hit,
      (0.4 * 2 * (previousHealth - health)) / settings.playerMaxStrength,
    );

    if (this.isMainCharacter) {
      VibrationHandler.vibrate(Math.min(200, (previousHealth - this.health) * 4));
    }
  }

  public onDie() {
    if (this.isMainCharacter) {
      VibrationHandler.vibrate(150);
    }
  }

  private step({ deltaTimeInSeconds }: StepCommand): void {
    this.head! = this.headExtrapolator.getValue(deltaTimeInSeconds);
    this.leftFoot! = this.leftFootExtrapolator.getValue(deltaTimeInSeconds);
    this.rightFoot! = this.rightFootExtrapolator.getValue(deltaTimeInSeconds);
  }

  public onShoot(strength: number) {
    SoundHandler.play(Sounds.shoot, (0.6 * strength) / settings.playerMaxStrength);
  }

  private beforeDestroy(): void {
    this.nameElement.parentElement?.removeChild(this.nameElement);
  }

  private draw({ renderer, overlay, shouldChangeLayout }: RenderCommand): void {
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
