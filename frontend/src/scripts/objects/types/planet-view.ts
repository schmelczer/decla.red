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
import { LinearInterpolator } from '../../helper/interpolators/linear-interpolator';
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
  // Rotation is owned by the backend (it drives the collision polygon too) and
  // streamed in; the interpolator replays the angle on the shared snapshot
  // timeline, in sync with the characters standing on the surface.
  private readonly rotationInterpolator = new LinearInterpolator(0);

  private flareLight?: CircleLight;
  private flareIntensity = 0;
  private holdsFlareSlot = false;

  protected commandExecutors: CommandExecutors = {
    [RenderCommand.type]: this.draw.bind(this),
    [StepCommand.type]: this.step.bind(this),
    [BeforeDestroyCommand.type]: this.beforeDestroy.bind(this),
    [UpdatePropertyCommand.type]: this.updateProperty.bind(this),
  };

  constructor(id: Id, vertices: Array<vec2>, ownership = 0.5, isKeystone = false) {
    super(id, vertices, ownership, isKeystone);
    this.shape = new PlanetShape(vertices, ownership);
    this.shape.randomOffset = Random.getRandom();

    this.ownershipProgress = document.createElement('div');
    this.ownershipProgress.className = 'ownership' + (isKeystone ? ' keystone' : '');
  }

  public setContested(contested: boolean) {
    this.ownershipProgress.classList.toggle('contested', contested);
  }

  private renderedRotation = 0;
  private rotationSpeed = 0;
  // Newest streamed rotation VALUE — the server-current angle at the latest
  // snapshot — as opposed to renderedRotation, which the interpolator holds
  // ~interpolationDelaySeconds in the PAST for drawing. The predictor seeds the
  // local body from the same snapshot's pose, so it must collide against the
  // planet at THIS (newest) phase and advance forward from it; using the drawn
  // lagged angle biases the body off the surface by omega*delay*radius and
  // wobbles it whenever the spin or the interpolator's rate cursor varies.
  private latestRotation = 0;
  public get predictionRotation(): number {
    return this.latestRotation;
  }
  public get predictionRotationSpeed(): number {
    return this.rotationSpeed;
  }

  private step({ deltaTimeInSeconds }: StepCommand): void {
    this.renderedRotation = this.rotationInterpolator.getValue(deltaTimeInSeconds);
    this.shape.rotation = this.renderedRotation;
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

  private updateProperty({
    propertyKey,
    propertyValue,
    rateOfChange,
  }: UpdatePropertyCommand): void {
    if (propertyKey === 'rotation') {
      this.rotationInterpolator.addFrame(propertyValue, rateOfChange);
      this.latestRotation = propertyValue;
      this.rotationSpeed = rateOfChange;
    } else {
      this.ownership = propertyValue;
    }
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
        element.className = 'falling-point ' + (this.ownership < 0.5 ? 'blue' : 'red');
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
    const sideBlue = this.ownership < 0.5;
    // Keep the ring neutral through the same dead-band that gates scoring
    // (settings.planetControlThreshold), so "the ring fills" and "this planet
    // pays my team" happen together rather than disagreeing.
    const control = Math.abs(this.ownership - 0.5);
    const t = settings.planetControlThreshold;
    const sidePercent = control <= t ? 0 : ((control - t) / (0.5 - t)) * 100;
    return sideBlue
      ? `conic-gradient(
      var(--bright-blue) ${sidePercent}%,
      var(--bright-blue) ${sidePercent}%,
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
