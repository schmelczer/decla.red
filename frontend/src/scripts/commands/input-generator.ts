import { vec2 } from 'gl-matrix';
import {
  Command,
  LeapActionCommand,
  MoveActionCommand,
  PrimaryActionCommand,
} from 'shared';
import {
  clientTimeMs,
  localCharacterPredictor,
} from '../helper/prediction/local-character-predictor';

export abstract class InputGenerator {
  constructor(protected readonly onCommand: (command: Command) => void) {}

  protected sendMove(direction: vec2) {
    this.onCommand(
      new MoveActionCommand(direction, localCharacterPredictor.recordInput(direction)),
    );
  }

  protected sendLeap() {
    this.onCommand(new LeapActionCommand(localCharacterPredictor.recordLeap()));
  }

  protected sendPrimary(position: vec2, charge: number) {
    this.onCommand(new PrimaryActionCommand(position, charge, clientTimeMs()));
  }
}
