import { vec2, vec3 } from 'gl-matrix';
import { CircleLight, Renderer } from 'sdf-2d';

import {
  characterCenter,
  Circle,
  Id,
  CharacterBase,
  CharacterTeam,
  settings,
  clamp,
  clamp01,
  mix,
  strengthToCharge,
  CommandExecutors,
  UpdatePropertyCommand,
} from 'shared';
import { BeforeDestroyCommand } from '../../commands/types/before-destroy';
import { RenderCommand } from '../../commands/types/render';
import { StepCommand } from '../../commands/types/step';
import { LinearInterpolator } from '../../helper/interpolators/linear-interpolator';
import { pointer } from '../../helper/pointer';
import { CharacterShape } from '../../shapes/character-shape';
import { SoundHandler, Sounds } from '../../sound-handler';
import { VibrationHandler } from '../../vibration-handler';
import { FeedbackHud } from '../../feedback-hud';
import { ScreenShake } from '../../screen-shake';

const muzzleFlashDecaySeconds = 0.12;
const hitFlashDecaySeconds = 0.15;

// No radius knob on CircleLight, so the death burst is sold by a bright (HDR) colour with a fast-decaying intensity.
const deathBurstDecaySeconds = 0.42;
const deathBurstMaxIntensity = 1.7;
const deathBurstColor = vec3.fromValues(2.5, 2.3, 2.1);

const killIcon =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M6.2,2.44L18.1,14.34L20.22,12.22L21.63,13.63L19.16,16.1L22.34,19.28C22.73,19.67 22.73,20.3 22.34,20.69L21.63,21.4C21.24,21.79 20.61,21.79 20.22,21.4L17,18.23L14.56,20.7L13.15,19.29L15.27,17.17L3.37,5.27V2.44H6.2M15.89,10L20.63,5.26V2.44H17.8L13.06,7.18L15.89,10M10.94,15L8.11,12.13L5.9,14.34L3.78,12.22L2.37,13.63L4.84,16.1L1.66,19.28C1.27,19.67 1.27,20.3 1.66,20.69L2.37,21.4C2.76,21.79 3.39,21.79 3.78,21.4L7,18.23L9.42,20.7L10.83,19.29L8.71,17.17L10.94,15Z"/></svg>';
const deathIcon =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path d="M12,2A9,9 0 0,0 3,11C3,14.03 4.53,16.82 7,18.47V22H9V19H11V22H13V19H15V18.46C17.47,16.81 19,14.03 19,11A9,9 0 0,0 12,2M8,11A2,2 0 0,1 10,13A2,2 0 0,1 8,15A2,2 0 0,1 6,13A2,2 0 0,1 8,11M16,11A2,2 0 0,1 18,13A2,2 0 0,1 16,15A2,2 0 0,1 14,13A2,2 0 0,1 16,11Z"/></svg>';

export class CharacterView extends CharacterBase {
  private shape: CharacterShape;
  private muzzleFlash: CircleLight;
  private muzzleFlashIntensity = 0;
  private hitFlashIntensity = 0;
  private deathBurst: CircleLight;
  private deathBurstIntensity = 0;
  private strength = settings.playerMaxStrength;
  private strengthInterpolator = new LinearInterpolator(settings.playerMaxStrength);
  private nameElement: HTMLElement = document.createElement('div');
  private statsElement: HTMLElement = document.createElement('div');
  private killCountElement: HTMLElement = document.createElement('span');
  private deathCountElement: HTMLElement = document.createElement('span');
  private healthElement: HTMLElement = document.createElement('div');
  private chargeElement: HTMLElement = document.createElement('div');

  public isMainCharacter = false;

  private lfx = new LinearInterpolator(0);
  private lfy = new LinearInterpolator(0);
  private lfr = new LinearInterpolator(0);
  private rfx = new LinearInterpolator(0);
  private rfy = new LinearInterpolator(0);
  private rfr = new LinearInterpolator(0);
  private hdx = new LinearInterpolator(0);
  private hdy = new LinearInterpolator(0);
  private hdr = new LinearInterpolator(0);

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
    this.shape = new CharacterShape(settings.colorIndices[team]);
    this.muzzleFlash = new CircleLight(
      vec2.clone(this.head!.center),
      settings.paletteDim[settings.colorIndices[team]],
      0,
    );
    this.deathBurst = new CircleLight(vec2.clone(this.head!.center), deathBurstColor, 0);

    const lf = this.leftFoot!;
    this.lfx = new LinearInterpolator(lf.center[0]);
    this.lfy = new LinearInterpolator(lf.center[1]);
    this.lfr = new LinearInterpolator(lf.radius);
    const rf = this.rightFoot!;
    this.rfx = new LinearInterpolator(rf.center[0]);
    this.rfy = new LinearInterpolator(rf.center[1]);
    this.rfr = new LinearInterpolator(rf.radius);
    const hd = this.head!;
    this.hdx = new LinearInterpolator(hd.center[0]);
    this.hdy = new LinearInterpolator(hd.center[1]);
    this.hdr = new LinearInterpolator(hd.radius);

    this.nameElement.className = 'player-tag ' + this.team;
    this.nameElement.innerText = this.name;
    this.healthElement.className = 'health';
    this.chargeElement.className = 'charge';

    this.statsElement.className = 'stats';
    this.killCountElement.className = 'value';
    this.deathCountElement.className = 'value';
    const killStat = document.createElement('span');
    killStat.className = 'stat kills';
    killStat.innerHTML = killIcon;
    killStat.appendChild(this.killCountElement);
    const deathStat = document.createElement('span');
    deathStat.className = 'stat deaths';
    deathStat.innerHTML = deathIcon;
    deathStat.appendChild(this.deathCountElement);
    this.statsElement.append(killStat, deathStat);

    this.nameElement.appendChild(this.healthElement);
    this.nameElement.appendChild(this.chargeElement);
    this.nameElement.appendChild(this.statsElement);
  }

  public get position(): vec2 {
    return this.head!.center;
  }

  public get bodyCenter(): vec2 {
    return characterCenter(this.head!, this.leftFoot!, this.rightFoot!);
  }

  public get facingDirection(): vec2 {
    const footAverage = vec2.add(
      vec2.create(),
      this.leftFoot!.center,
      this.rightFoot!.center,
    );
    vec2.scale(footAverage, footAverage, 0.5);
    const forward = vec2.subtract(footAverage, this.head!.center, footAverage);
    return vec2.length(forward) > 0
      ? vec2.normalize(forward, forward)
      : vec2.fromValues(0, 1);
  }

  public get strengthFraction(): number {
    return clamp01(this.strength / settings.playerMaxStrength);
  }

  private updateProperty({
    propertyKey,
    propertyValue,
    rateOfChange,
  }: UpdatePropertyCommand) {
    if (propertyKey === 'head') {
      this.hdx.addFrame(propertyValue.center[0], rateOfChange.center[0]);
      this.hdy.addFrame(propertyValue.center[1], rateOfChange.center[1]);
      this.hdr.addFrame(propertyValue.radius, rateOfChange.radius);
    }
    if (propertyKey === 'leftFoot') {
      this.lfx.addFrame(propertyValue.center[0], rateOfChange.center[0]);
      this.lfy.addFrame(propertyValue.center[1], rateOfChange.center[1]);
      this.lfr.addFrame(propertyValue.radius, rateOfChange.radius);
    }
    if (propertyKey === 'rightFoot') {
      this.rfx.addFrame(propertyValue.center[0], rateOfChange.center[0]);
      this.rfy.addFrame(propertyValue.center[1], rateOfChange.center[1]);
      this.rfr.addFrame(propertyValue.radius, rateOfChange.radius);
    }
    if (propertyKey === 'strength') {
      this.strengthInterpolator.addFrame(propertyValue, rateOfChange);
    }
  }

  public setHealth(health: number) {
    const damage = this.health - health;
    super.setHealth(health);

    if (damage > 0) {
      SoundHandler.play(
        Sounds.hit,
        Math.min(1, (0.8 * damage) / settings.playerMaxStrength),
      );
      this.hitFlashIntensity = Math.min(1, 0.4 + damage / settings.playerMaxStrength);

      if (this.isMainCharacter) {
        VibrationHandler.vibrate(Math.min(200, damage * 4));
        ScreenShake.add(clamp01(0.12 + (0.5 * damage) / settings.playerMaxStrength));
      }
    }
  }

  public onDie() {
    if (this.isMainCharacter) {
      VibrationHandler.vibrate(150);
    }
    // Visible to everyone who can see the body: a white-hot flash plus a full-body whiteout.
    this.deathBurstIntensity = 1;
    this.hitFlashIntensity = 1;
  }

  public onHitConfirmed(charge = 0) {
    if (!this.isMainCharacter) {
      return;
    }
    // Layer a meaty thud under the crisp confirmation tick; a charged hit lands lower and harder.
    SoundHandler.play(Sounds.hit, mix(0.35, 0.7, charge), mix(1.3, 0.95, charge));
    SoundHandler.play(Sounds.click, mix(0.4, 0.75, charge), mix(1.7, 1.1, charge));
    ScreenShake.add(mix(0.22, 0.5, charge));
    VibrationHandler.vibrate(Math.round(mix(12, 35, charge)));
    FeedbackHud.hitMarker(charge);
  }

  public onKillConfirmed(victimName?: string, streak = 1, charge = 0) {
    if (!this.isMainCharacter) {
      return;
    }
    // A heavy low thud for the kill with a brighter confirmation over the top, a hard frame jolt, a zoom-punch, and a double-thump rumble.
    SoundHandler.play(Sounds.hit, 1, mix(0.62, 0.5, charge));
    SoundHandler.play(Sounds.click, 0.9, mix(0.6, 0.45, charge));
    ScreenShake.add(mix(0.75, 1, charge));
    ScreenShake.addPunch(mix(0.7, 1, charge));
    VibrationHandler.vibrate([45, 35, Math.round(mix(80, 130, charge))]);
    FeedbackHud.killConfirmed(victimName, streak, charge);
  }

  public onLeap() {
    if (!this.isMainCharacter) {
      return;
    }
    SoundHandler.play(Sounds.shoot, 0.3, 1.5);
  }

  private step({ deltaTimeInSeconds }: StepCommand): void {
    this.head! = new Circle(
      vec2.fromValues(
        this.hdx.getValue(deltaTimeInSeconds),
        this.hdy.getValue(deltaTimeInSeconds),
      ),
      this.hdr.getValue(deltaTimeInSeconds),
    );
    this.leftFoot! = new Circle(
      vec2.fromValues(
        this.lfx.getValue(deltaTimeInSeconds),
        this.lfy.getValue(deltaTimeInSeconds),
      ),
      this.lfr.getValue(deltaTimeInSeconds),
    );
    this.rightFoot! = new Circle(
      vec2.fromValues(
        this.rfx.getValue(deltaTimeInSeconds),
        this.rfy.getValue(deltaTimeInSeconds),
      ),
      this.rfr.getValue(deltaTimeInSeconds),
    );

    this.strength = clamp(
      this.strengthInterpolator.getValue(deltaTimeInSeconds),
      0,
      settings.playerMaxStrength,
    );

    if (this.muzzleFlashIntensity > 0) {
      this.muzzleFlashIntensity = Math.max(
        0,
        this.muzzleFlashIntensity - deltaTimeInSeconds / muzzleFlashDecaySeconds,
      );
      this.muzzleFlash.center = this.head!.center;
      this.muzzleFlash.intensity = this.muzzleFlashIntensity;
    }

    if (this.hitFlashIntensity > 0) {
      this.hitFlashIntensity = Math.max(
        0,
        this.hitFlashIntensity - deltaTimeInSeconds / hitFlashDecaySeconds,
      );
    }

    if (this.deathBurstIntensity > 0) {
      this.deathBurstIntensity = Math.max(
        0,
        this.deathBurstIntensity - deltaTimeInSeconds / deathBurstDecaySeconds,
      );
      this.deathBurst.center = this.bodyCenter;
      // Square the envelope so the flash blooms then drops off sharply rather
      // than fading out in a flat ramp.
      this.deathBurst.intensity =
        deathBurstMaxIntensity * this.deathBurstIntensity * this.deathBurstIntensity;
    }
  }

  public onShoot(strength: number) {
    const q = strengthToCharge(strength);
    SoundHandler.play(Sounds.shoot, mix(0.55, 1, q), mix(1.15, 0.8, q));
    this.muzzleFlashIntensity = mix(0.35, 1, q);
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
      this.chargeElement.style.width =
        (50 * this.strength) / settings.playerMaxStrength + 'px';
      this.killCountElement.innerText = String(this.killCount);
      this.deathCountElement.innerText = String(this.deathCount);
    }

    this.shape.hitFlash = this.hitFlashIntensity;
    this.shape.gazeTarget = this.calculateGazeTarget(renderer);
    this.shape.setCircles([this.head!, this.leftFoot!, this.rightFoot!]);
    renderer.addDrawable(this.shape);

    if (this.muzzleFlashIntensity > 0) {
      renderer.addDrawable(this.muzzleFlash);
    }

    if (this.deathBurstIntensity > 0) {
      renderer.addDrawable(this.deathBurst);
    }
  }

  private calculateGazeTarget(renderer: Renderer): vec2 {
    const cursor = pointer.displayPosition;
    if (this.isMainCharacter && cursor) {
      return renderer.displayToWorldCoordinates(cursor);
    }

    return vec2.scaleAndAdd(
      vec2.create(),
      this.head!.center,
      this.facingDirection,
      this.head!.radius * 8,
    );
  }

  private calculateTextPosition(): vec2 {
    return vec2.scaleAndAdd(
      vec2.create(),
      this.head!.center,
      this.facingDirection,
      this.head!.radius + 80,
    );
  }
}
