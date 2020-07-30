import { GameObject } from '../game-object';
import { RenderCommand } from '../../drawing/commands/render';

export class InfoText extends GameObject {
  constructor() {
    super();

    this.addCommandExecutor(RenderCommand, this.draw.bind(this));
  }

  private static records: Map<string, string> = new Map();

  public static modifyRecord(key: string, value: string) {
    InfoText.records.set(key, value);
  }

  private draw(e: RenderCommand) {
    let text = '';
    InfoText.records.forEach((v, k) => (text += `${k}\n\t${v}\n`));
    e.renderer.drawInfoText(text);
  }
}
