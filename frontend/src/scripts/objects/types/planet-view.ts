import { vec2, vec3 } from 'gl-matrix';
import { CircleLight } from 'sdf-2d';
import {
  Id,
  Random,
  PlanetBase,
  UpdatePropertyCommand,
  CommandExecutors,
  CharacterTeam,
  settings,
} from 'shared';
import { BeforeDestroyCommand } from '../../commands/types/before-destroy';
import { RenderCommand } from '../../commands/types/render';
import { StepCommand } from '../../commands/types/step';
import { PlanetShape } from '../../shapes/planet-shape';

const fallingPointLifetimeMs = 2000;

// Global budget for simultaneously-lit capture flares, so a clustered wave of
// captures can never white out the SDF exposure — excess flips still pulse the
// ring and toast, they just skip the extra light. The acquire/release pair keeps
// the count in one place instead of being hand-maintained at every call site.
abstract class FlareBudget {
  private static active = 0;

  public static tryAcquire(): boolean {
    if (FlareBudget.active >= settings.maxConcurrentFlipFlares) {
      return false;
    }
    FlareBudget.active++;
    return true;
  }

  public static release(): void {
    FlareBudget.active = Math.max(0, FlareBudget.active - 1);
  }
}

export class PlanetView extends PlanetBase {
  private shape: PlanetShape;
  private ownershipProgress: HTMLElement;
  private readonly rotationSpeed: number;

  private flareLight?: CircleLight;
  private flareIntensity = 0;
  private holdsFlareSlot = false;

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: this.draw.bind(this),
    [StepCommand.type]: this.step.bind(this),
    [BeforeDestroyCommand.type]: this.beforeDestroy.bind(this),
    [UpdatePropertyCommand.type]: this.updateProperty.bind(this),
  };

  constructor(id: Id, vertices: Array<vec2>, ownership: number) {
    super(id, vertices);
    this.shape = new PlanetShape(vertices, ownership);
    this.shape.randomOffset = Random.getRandom();
    this.rotationSpeed =
      (0.05 + Random.getRandom() * 0.07) * (Random.getRandom() < 0.5 ? -1 : 1);

    this.ownershipProgress = document.createElement('div');
    this.ownershipProgress.className = 'ownership';
  }

  private step({ deltaTimeInSeconds }: StepCommand): void {
    this.shape.rotation += deltaTimeInSeconds * this.rotationSpeed;
    this.shape.colorMixQ = this.ownership;

    if (this.flareIntensity > 0) {
      this.flareIntensity = Math.max(
        0,
        this.flareIntensity - deltaTimeInSeconds / settings.lampFlareDecaySeconds,
      );

      if (this.flareLight) {
        this.flareLight.intensity =
          settings.lampFlareIntensity * this.flareIntensity * this.flareIntensity;
      }

      if (this.flareIntensity === 0) {
        this.releaseFlareSlot();
      }
    }
  }

  private releaseFlareSlot(): void {
    if (this.holdsFlareSlot) {
      this.holdsFlareSlot = false;
      FlareBudget.release();
    }
  }

  private lastGeneratedPoint?: number;
  public generatedPoints(value: number) {
    this.lastGeneratedPoint = value;
  }

  public onFlipped(team: CharacterTeam): void {
    const color = settings.palette[settings.colorIndices[team]];

    if (!this.flareLight) {
      this.flareLight = new CircleLight(vec2.clone(this.center), vec3.clone(color), 0);
    } else {
      this.flareLight.color = vec3.clone(color);
    }

    if (!this.holdsFlareSlot) {
      if (!FlareBudget.tryAcquire()) {
        return;
      }
      this.holdsFlareSlot = true;
    }

    this.flareIntensity = 1;
  }

  private beforeDestroy(): void {
    this.ownershipProgress.parentElement?.removeChild(this.ownershipProgress);
    this.releaseFlareSlot();
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

      this.ownershipProgress.style.transform = `translateX(${screenPosition.x}px) translateY(${screenPosition.y}px) translateX(-50%) translateY(-50%)`;
      this.ownershipProgress.style.background = this.getGradient();

      if (this.lastGeneratedPoint !== undefined) {
        const element = document.createElement('div');
        element.className = 'falling-point ' + (this.ownership < 0.5 ? 'decla' : 'red');
        element.innerText = '+' + this.lastGeneratedPoint;
        element.style.left = `${screenPosition.x}px`;
        element.style.top = `${screenPosition.y}px`;
        overlay.appendChild(element);
        setTimeout(
          () => element.parentElement?.removeChild(element),
          fallingPointLifetimeMs,
        );

        this.lastGeneratedPoint = undefined;
      }
    }

    renderer.addDrawable(this.shape);

    if (this.flareIntensity > 0 && this.flareLight) {
      renderer.addDrawable(this.flareLight);
    }
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
