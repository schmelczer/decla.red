import { vec2, vec3 } from 'gl-matrix';
import { CircleLight, Renderer } from 'sdf-2d';
import {
  Id,
  Random,
  PlanetBase,
  UpdatePropertyCommand,
  CharacterTeam,
  settings,
} from 'shared';
import { centeredTransform } from '../../helper/centered-transform';
import { LinearInterpolator } from '../../helper/interpolators/linear-interpolator';
import { PlanetShape } from '../../shapes/planet-shape';
import { View } from '../view';

const fallingPointLifetimeMs = 2000;

let activeFlares = 0;

export class PlanetView extends PlanetBase implements View {
  // Rotation as of the newest snapshot: the predictor collides at this phase, not the drawn one.
  public snapshotRotation = 0;
  public snapshotRotationSpeed = 0;

  private readonly shape: PlanetShape;
  private readonly ownershipProgress = document.createElement('div');
  private readonly rotationInterpolator = new LinearInterpolator(0);

  private flareLight?: CircleLight;
  private flareIntensity = 0;
  private holdsFlareSlot = false;
  private lastGeneratedPoint?: number;
  private lastGradient?: string;

  constructor(id: Id, vertices: Array<vec2>, ownership = 0.5, isKeystone = false) {
    super(id, vertices, ownership, isKeystone);
    this.shape = new PlanetShape(vertices, ownership);
    this.shape.randomOffset = Random.getRandom();
    this.ownershipProgress.className = 'ownership' + (isKeystone ? ' keystone' : '');
  }

  public setContested(contested: boolean) {
    this.ownershipProgress.classList.toggle('contested', contested);
  }

  public generatedPoints(value: number) {
    this.lastGeneratedPoint = value;
  }

  public onFlipped(team: CharacterTeam) {
    const color = settings.palette[settings.colorIndices[team]];

    if (!this.flareLight) {
      this.flareLight = new CircleLight(vec2.clone(this.center), vec3.clone(color), 0);
    } else {
      this.flareLight.color = vec3.clone(color);
    }

    if (!this.holdsFlareSlot) {
      if (activeFlares >= settings.maxConcurrentFlipFlares) {
        return;
      }
      activeFlares++;
      this.holdsFlareSlot = true;
    }

    this.flareIntensity = 1;
  }

  public updateProperty({
    propertyKey,
    propertyValue,
    rateOfChange,
  }: UpdatePropertyCommand) {
    if (propertyKey === 'rotation') {
      this.rotationInterpolator.addFrame(propertyValue, rateOfChange);
      this.snapshotRotation = propertyValue;
      this.snapshotRotationSpeed = rateOfChange;
    } else {
      this.ownership = propertyValue;
    }
  }

  public step(deltaTimeInSeconds: number) {
    this.shape.rotation = this.rotationInterpolator.getValue(deltaTimeInSeconds);
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

  public beforeDestroy() {
    this.ownershipProgress.remove();
    this.releaseFlareSlot();
  }

  private releaseFlareSlot() {
    if (this.holdsFlareSlot) {
      this.holdsFlareSlot = false;
      activeFlares--;
    }
  }

  public render(renderer: Renderer, overlay: HTMLElement, shouldChangeLayout: boolean) {
    if (shouldChangeLayout) {
      if (!this.ownershipProgress.parentElement) {
        overlay.appendChild(this.ownershipProgress);
      }

      const screenPosition = renderer.worldToDisplayCoordinates(this.center);
      this.ownershipProgress.style.transform = centeredTransform(
        screenPosition[0],
        screenPosition[1],
      );

      const gradient = this.getGradient();
      if (gradient !== this.lastGradient) {
        this.lastGradient = gradient;
        this.ownershipProgress.style.background = gradient;
      }

      if (this.lastGeneratedPoint !== undefined) {
        const element = document.createElement('div');
        element.className = 'falling-point ' + (this.ownership < 0.5 ? 'blue' : 'red');
        element.innerText = '+' + this.lastGeneratedPoint;
        element.style.left = `${screenPosition[0]}px`;
        element.style.top = `${screenPosition[1]}px`;
        overlay.appendChild(element);
        setTimeout(() => element.remove(), fallingPointLifetimeMs);
        this.lastGeneratedPoint = undefined;
      }
    }

    renderer.addDrawable(this.shape);

    if (this.flareIntensity > 0 && this.flareLight) {
      renderer.addDrawable(this.flareLight);
    }
  }

  private getGradient(): string {
    const control = Math.abs(this.ownership - 0.5);
    const t = settings.planetControlThreshold;
    const sidePercent = control <= t ? 0 : ((control - t) / (0.5 - t)) * 100;
    return this.ownership < 0.5
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
