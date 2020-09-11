import { RenderCommand } from '../../drawing/commands/render';
import { GameObject } from '../game-object';

export class InfoText extends GameObject {
  private static MinRowLength = 60;

  constructor() {
    super();

    this.addCommandExecutor(RenderCommand, this.draw.bind(this));
  }

  private static records: Map<string, string> = new Map();

  public static modifyRecord(key: string, value: string | any) {
    if (typeof value == 'string') {
      value = '  ' + value;
    } else {
      value = JSON.stringify(
        value,
        (_, v) => (v.toFixed ? Number(v.toFixed(2)) : v),
        '  '
      );
    }

    InfoText.records.set(key, value);
  }

  private draw(e: RenderCommand) {
    let text = '';
    InfoText.records.forEach(
      (v, k) => (text += `${k}\n${v.padEnd(InfoText.MinRowLength)}\n`)
    );
    e.renderer.drawInfoText(text);
  }
}
