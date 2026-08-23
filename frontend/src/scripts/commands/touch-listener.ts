import { vec2 } from 'gl-matrix';
import { chargeHeldSince, Command, settings } from 'shared';
import { Game } from '../game';
import { ChargeIndicator } from '../charge-indicator';
import { InputGenerator } from './input-generator';

const deadZone = 8;
const deltaScaling = 0.4;
const aimDeadZone = 18;
const joystickMaxLength = 20;

export class TouchListener extends InputGenerator {
  private readonly joystick = document.createElement('div');
  private readonly joystickButton = document.createElement('div');
  private readonly fireButton = document.createElement('div');
  private readonly fireStrengthRing = document.createElement('div');
  private readonly fireAimLine = document.createElement('div');
  private readonly leapButton = document.createElement('div');

  private isJoystickActive = false;
  private touchStartPosition = vec2.create();
  private primaryDownAt: number | null = null;
  private gestureTouchId: number | null = null;

  private fireDownAt: number | null = null;
  private fireButtonCenter = vec2.create();
  private fireAim: vec2 | null = null;

  constructor(
    private readonly target: HTMLElement,
    private readonly overlay: HTMLElement,
    private readonly game: Game,
    onCommand: (command: Command) => void,
  ) {
    super(onCommand);

    this.joystick.className = 'joystick';
    this.joystick.appendChild(this.joystickButton);

    this.fireButton.className = 'touch-button fire';
    this.fireStrengthRing.className = 'strength-ring';
    this.fireAimLine.className = 'aim-line';
    this.fireButton.append(this.fireStrengthRing, this.fireAimLine);
    this.fireButton.addEventListener('touchstart', this.fireButtonDownListener);
    this.fireButton.addEventListener('touchmove', this.fireButtonMoveListener);
    this.fireButton.addEventListener('touchend', this.fireButtonUpListener);

    this.leapButton.className = 'touch-button leap';
    this.leapButton.addEventListener('touchstart', this.leapButtonListener);

    target.addEventListener('touchstart', this.touchStartListener);
    target.addEventListener('touchmove', this.touchMoveListener);
    target.addEventListener('touchend', this.touchEndListener);
    target.addEventListener('touchcancel', this.touchCancelListener);
  }

  private findGestureTouch(list: TouchList): Touch | undefined {
    for (let i = 0; i < list.length; i++) {
      if (list[i].identifier === this.gestureTouchId) {
        return list[i];
      }
    }
    return undefined;
  }

  private touchStartListener = (event: TouchEvent) => {
    event.preventDefault();
    const touch = event.changedTouches[event.changedTouches.length - 1];
    if (!touch) {
      return;
    }
    if (this.isJoystickActive) {
      this.sendPrimary(
        this.game.displayToWorldCoordinates(
          vec2.fromValues(touch.clientX, touch.clientY),
        ),
        0,
      );
    } else {
      this.gestureTouchId = touch.identifier;
      vec2.set(this.touchStartPosition, touch.clientX, touch.clientY);
      this.primaryDownAt = performance.now();
      ChargeIndicator.begin(touch.clientX, touch.clientY);
    }
  };

  private touchMoveListener = (event: TouchEvent) => {
    event.preventDefault();

    const touch = this.findGestureTouch(event.touches);
    if (!touch) {
      return;
    }

    const delta = vec2.fromValues(
      touch.clientX - this.touchStartPosition[0],
      touch.clientY - this.touchStartPosition[1],
    );
    vec2.scale(delta, delta, deltaScaling);
    const deltaLength = vec2.length(delta);

    if (!this.isJoystickActive && deltaLength > deadZone) {
      this.isJoystickActive = true;
      this.primaryDownAt = null;
      ChargeIndicator.end();
      this.overlay.appendChild(this.joystick);
      this.joystick.style.transform = `translateX(${this.touchStartPosition[0]}px) translateY(${this.touchStartPosition[1]}px) translateX(-50%) translateY(-50%)`;
    }

    vec2.scale(delta, delta, Math.min(1, joystickMaxLength / deltaLength));
    this.joystickButton.style.transform = `translateX(${delta[0]}px) translateY(${delta[1]}px) translateX(-50%) translateY(-50%)`;

    if (deltaLength > deadZone) {
      vec2.set(delta, delta[0], -delta[1]);
      this.sendMove(vec2.normalize(delta, delta));
    } else {
      this.sendMove(vec2.create());
    }
  };

  private touchEndListener = (event: TouchEvent) => {
    event.preventDefault();

    const touch = this.findGestureTouch(event.changedTouches);
    if (!touch) {
      return;
    }
    this.gestureTouchId = null;

    if (this.isJoystickActive) {
      this.releaseJoystick();
      return;
    }

    ChargeIndicator.end();
    const charge = this.primaryDownAt === null ? 0 : chargeHeldSince(this.primaryDownAt);
    this.primaryDownAt = null;
    this.sendPrimary(
      this.game.displayToWorldCoordinates(vec2.fromValues(touch.clientX, touch.clientY)),
      charge,
    );
  };

  private touchCancelListener = (event: TouchEvent) => {
    if (!this.findGestureTouch(event.changedTouches)) {
      return;
    }
    this.gestureTouchId = null;
    this.primaryDownAt = null;
    ChargeIndicator.end();
    if (this.isJoystickActive) {
      this.releaseJoystick();
    }
  };

  private releaseJoystick() {
    this.isJoystickActive = false;
    this.joystick.remove();
    this.sendMove(vec2.create());
  }

  private swallowTouch(event: TouchEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  private leapButtonListener = (event: TouchEvent) => {
    this.swallowTouch(event);
    this.sendLeap();
  };

  private fireButtonDownListener = (event: TouchEvent) => {
    this.swallowTouch(event);
    this.fireDownAt = performance.now();
    const rect = this.fireButton.getBoundingClientRect();
    vec2.set(
      this.fireButtonCenter,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    this.fireAim = null;
    ChargeIndicator.begin(this.fireButtonCenter[0], this.fireButtonCenter[1]);
  };

  private fireButtonMoveListener = (event: TouchEvent) => {
    this.swallowTouch(event);
    const touch = event.targetTouches[0] ?? event.changedTouches[0];
    if (this.fireDownAt === null || !touch) {
      return;
    }
    const aim = this.aimFromTouch(touch);
    this.fireAim = aim;
    if (aim) {
      this.fireAimLine.style.opacity = '1';
      this.fireAimLine.style.transform = `translateY(-50%) rotate(${Math.atan2(-aim[1], aim[0])}rad)`;
    } else {
      this.fireAimLine.style.opacity = '0';
    }
  };

  private aimFromTouch(touch: Touch): vec2 | null {
    const dx = touch.clientX - this.fireButtonCenter[0];
    const dy = touch.clientY - this.fireButtonCenter[1];
    if (dx * dx + dy * dy <= aimDeadZone * aimDeadZone) {
      return null;
    }
    const aim = vec2.fromValues(dx, -dy);
    return vec2.normalize(aim, aim);
  }

  private fireButtonUpListener = (event: TouchEvent) => {
    this.swallowTouch(event);
    ChargeIndicator.end();
    this.fireAimLine.style.opacity = '0';
    if (this.fireDownAt === null) {
      return;
    }

    const charge = chargeHeldSince(this.fireDownAt);
    this.fireDownAt = null;

    const character = this.game.gameObjects.localPlayer;
    if (!character) {
      return;
    }

    const direction = this.fireAim ?? character.facingDirection;
    this.fireAim = null;
    this.sendPrimary(
      vec2.scaleAndAdd(
        vec2.create(),
        character.bodyCenter,
        direction,
        settings.touchAimRange,
      ),
      charge,
    );
  };

  public update() {
    if (!this.fireButton.parentElement) {
      this.overlay.append(this.fireButton, this.leapButton);
    }

    const character = this.game.gameObjects.localPlayer;
    if (character) {
      this.fireStrengthRing.style.background = `conic-gradient(rgba(255, 255, 255, 0.75) ${
        character.strengthFraction * 360
      }deg, transparent 0deg)`;
    }
  }

  public destroy() {
    ChargeIndicator.end();
    this.target.removeEventListener('touchstart', this.touchStartListener);
    this.target.removeEventListener('touchmove', this.touchMoveListener);
    this.target.removeEventListener('touchend', this.touchEndListener);
    this.target.removeEventListener('touchcancel', this.touchCancelListener);

    this.fireButton.removeEventListener('touchstart', this.fireButtonDownListener);
    this.fireButton.removeEventListener('touchmove', this.fireButtonMoveListener);
    this.fireButton.removeEventListener('touchend', this.fireButtonUpListener);
    this.leapButton.removeEventListener('touchstart', this.leapButtonListener);

    this.fireButton.remove();
    this.leapButton.remove();
  }
}
