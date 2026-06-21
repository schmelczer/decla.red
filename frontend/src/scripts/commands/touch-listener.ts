import { vec2 } from 'gl-matrix';
import {
  CommandGenerator,
  MoveActionCommand,
  last,
  PrimaryActionCommand,
  LeapActionCommand,
  holdDurationToCharge,
  settings,
} from 'shared';
import { Game } from '../game';
import { ChargeIndicator } from '../charge-indicator';
import { localCharacterPredictor } from '../helper/prediction/local-character-predictor';

export class TouchListener extends CommandGenerator {
  private static readonly deadZone = 8;
  private static readonly deltaScaling = 0.4;
  // Min screen drag (px) from the fire button before a shot is aimed by the
  // drag direction instead of firing straight ahead.
  private static readonly aimDeadZone = 18;

  private joystick: HTMLElement;
  private joystickButton: HTMLElement;
  private isJoystickActive = false;
  private touchStartPosition!: vec2;
  private primaryDownAt: number | null = null;

  private fireButton: HTMLElement;
  private fireStrengthRing: HTMLElement;
  private fireAimLine!: HTMLElement;
  private leapButton: HTMLElement;

  private fireDownAt: number | null = null;
  private fireButtonCenter: vec2 | null = null;
  private fireAimScreen: vec2 | null = null;

  constructor(
    private target: HTMLElement,
    private overlay: HTMLElement,
    private readonly game: Game,
  ) {
    super();

    this.joystick = document.createElement('div');
    this.joystick.className = 'joystick';
    this.joystickButton = document.createElement('div');
    this.joystick.appendChild(this.joystickButton);

    this.fireButton = document.createElement('div');
    this.fireButton.className = 'touch-button fire';
    this.fireStrengthRing = document.createElement('div');
    this.fireStrengthRing.className = 'strength-ring';
    this.fireButton.appendChild(this.fireStrengthRing);
    this.fireAimLine = document.createElement('div');
    this.fireAimLine.className = 'aim-line';
    this.fireButton.appendChild(this.fireAimLine);

    this.fireButton.addEventListener('touchstart', this.fireButtonDownListener);
    this.fireButton.addEventListener('touchmove', this.fireButtonMoveListener);
    this.fireButton.addEventListener('touchend', this.fireButtonUpListener);

    this.leapButton = document.createElement('div');
    this.leapButton.className = 'touch-button leap';
    this.leapButton.addEventListener('touchstart', this.leapButtonListener);

    this.overlay.appendChild(this.fireButton);
    this.overlay.appendChild(this.leapButton);

    target.addEventListener('touchstart', this.touchStartListener);
    target.addEventListener('touchmove', this.touchMoveListener);
    target.addEventListener('touchend', this.touchEndListener);
  }

  private touchStartListener = (event: TouchEvent) => {
    event.preventDefault();
    if (this.isJoystickActive) {
      const center = vec2.fromValues(
        last(event.touches)!.clientX,
        last(event.touches)!.clientY,
      );
      this.sendCommandToSubscribers(
        new PrimaryActionCommand(this.game.displayToWorldCoordinates(center)),
      );
    } else {
      this.touchStartPosition = vec2.fromValues(
        event.touches[0].clientX,
        event.touches[0].clientY,
      );
      this.primaryDownAt = performance.now();
      ChargeIndicator.begin(this.touchStartPosition.x, this.touchStartPosition.y);
    }
  };

  private touchMoveListener = (event: TouchEvent) => {
    event.preventDefault();

    const touchPosition = vec2.fromValues(
      event.touches[0].clientX,
      event.touches[0].clientY,
    );

    const delta = vec2.subtract(vec2.create(), touchPosition, this.touchStartPosition);
    vec2.scale(delta, delta, TouchListener.deltaScaling);
    const deltaLength = vec2.length(delta);

    if (!this.isJoystickActive && deltaLength > TouchListener.deadZone) {
      this.isJoystickActive = true;
      this.primaryDownAt = null;
      ChargeIndicator.end();
      this.overlay.appendChild(this.joystick);
      this.joystickButton.style.transform = `translateX(-50%) translateY(-50%)`;
      this.joystick.style.transform = `translateX(${this.touchStartPosition.x}px) translateY(${this.touchStartPosition.y}px) translateX(-50%) translateY(-50%)`;
    }

    const maxLength = 20;
    vec2.scale(delta, delta, Math.min(1, maxLength / deltaLength));
    this.joystickButton.style.transform = `translateX(${delta.x}px) translateY(${delta.y}px) translateX(-50%) translateY(-50%)`;

    vec2.set(delta, delta.x, -delta.y);
    if (deltaLength > TouchListener.deadZone) {
      const direction = vec2.normalize(delta, delta);
      this.sendMove(direction);
    } else {
      this.sendMove(vec2.create());
    }
  };

  private sendMove(direction: vec2) {
    const clientTimeMs = localCharacterPredictor.recordInput(direction);
    this.sendCommandToSubscribers(new MoveActionCommand(direction, clientTimeMs));
  }

  private touchEndListener = (event: TouchEvent) => {
    event.preventDefault();

    if (!this.isJoystickActive) {
      ChargeIndicator.end();
      const charge =
        this.primaryDownAt === null
          ? 0
          : holdDurationToCharge((performance.now() - this.primaryDownAt) / 1000);
      this.primaryDownAt = null;
      const center = vec2.fromValues(
        event.changedTouches[0].clientX,
        event.changedTouches[0].clientY,
      );
      this.sendCommandToSubscribers(
        new PrimaryActionCommand(this.game.displayToWorldCoordinates(center), charge),
      );
    } else if (event.touches.length === 0) {
      this.isJoystickActive = false;
      this.joystick.parentElement?.removeChild(this.joystick);
      this.sendMove(vec2.create());
    }
  };

  private swallowTouch = (event: TouchEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  private leapButtonListener = (event: TouchEvent) => {
    this.swallowTouch(event);
    const clientTimeMs = localCharacterPredictor.recordLeap();
    this.sendCommandToSubscribers(new LeapActionCommand(clientTimeMs));
  };

  private fireButtonDownListener = (event: TouchEvent) => {
    this.swallowTouch(event);
    this.fireDownAt = performance.now();
    const rect = this.fireButton.getBoundingClientRect();
    this.fireButtonCenter = vec2.fromValues(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    this.fireAimScreen = null;
    ChargeIndicator.begin(this.fireButtonCenter[0], this.fireButtonCenter[1]);
  };

  // Dragging from the fire button aims the shot: the drag vector sets the
  // direction, decoupling aim from movement so a touch player can fire one way
  // while walking another. A tap with no meaningful drag fires straight ahead.
  private fireButtonMoveListener = (event: TouchEvent) => {
    this.swallowTouch(event);
    if (this.fireDownAt === null || !this.fireButtonCenter) {
      return;
    }
    const touch = event.targetTouches[0] ?? event.changedTouches[0];
    if (!touch) {
      return;
    }
    this.fireAimScreen = vec2.fromValues(touch.clientX, touch.clientY);
    const dx = this.fireAimScreen[0] - this.fireButtonCenter[0];
    const dy = this.fireAimScreen[1] - this.fireButtonCenter[1];
    if (dx * dx + dy * dy > TouchListener.aimDeadZone * TouchListener.aimDeadZone) {
      this.fireAimLine.style.opacity = '1';
      this.fireAimLine.style.transform = `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)`;
    } else {
      this.fireAimLine.style.opacity = '0';
    }
  };

  private fireButtonUpListener = (event: TouchEvent) => {
    this.swallowTouch(event);
    ChargeIndicator.end();
    this.fireAimLine.style.opacity = '0';
    if (this.fireDownAt === null) {
      return;
    }

    const charge = holdDurationToCharge((performance.now() - this.fireDownAt) / 1000);
    this.fireDownAt = null;

    const character = this.game.gameObjects.player;
    if (!character) {
      this.fireButtonCenter = null;
      this.fireAimScreen = null;
      return;
    }

    // Screen drag → world aim direction (flip Y: screen +y is down). Below the
    // dead-zone it's a tap, so fall back to firing along the facing direction.
    let direction = character.facingDirection;
    if (this.fireButtonCenter && this.fireAimScreen) {
      const dx = this.fireAimScreen[0] - this.fireButtonCenter[0];
      const dy = this.fireAimScreen[1] - this.fireButtonCenter[1];
      if (dx * dx + dy * dy > TouchListener.aimDeadZone * TouchListener.aimDeadZone) {
        direction = vec2.normalize(vec2.create(), vec2.fromValues(dx, -dy));
      }
    }
    this.fireButtonCenter = null;
    this.fireAimScreen = null;

    const aim = vec2.scaleAndAdd(
      vec2.create(),
      character.bodyCenter,
      direction,
      settings.touchAimRange,
    );
    this.sendCommandToSubscribers(new PrimaryActionCommand(aim, charge));
  };

  public update(_deltaTimeInSeconds: number) {
    if (!this.fireButton.parentElement) {
      this.overlay.appendChild(this.fireButton);
    }
    if (!this.leapButton.parentElement) {
      this.overlay.appendChild(this.leapButton);
    }

    const character = this.game.gameObjects.player;
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

    this.fireButton.removeEventListener('touchstart', this.fireButtonDownListener);
    this.fireButton.removeEventListener('touchmove', this.fireButtonMoveListener);
    this.fireButton.removeEventListener('touchend', this.fireButtonUpListener);
    this.leapButton.removeEventListener('touchstart', this.leapButtonListener);

    this.fireButton.parentElement?.removeChild(this.fireButton);
    this.leapButton.parentElement?.removeChild(this.leapButton);
  }
}
