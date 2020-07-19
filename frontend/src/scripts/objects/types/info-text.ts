import { GameObject } from '../game-object';
import { DrawCommand } from '../../commands/types/draw';

export class InfoText extends GameObject {
  constructor() {
    super();

    this.addCommandExecutor(DrawCommand, this.draw.bind(this));
  }

  private static records: Map<string, string> = new Map();

  public static modifyRecord(key: string, value: string) {
    InfoText.records.set(key, value);
  }

  private draw(e: DrawCommand) {
    let text = '';
    InfoText.records.forEach((v, k) => (text += `${k}\n\t${v}\n`));
    e.drawer.drawInfoText(text);
  }
}
