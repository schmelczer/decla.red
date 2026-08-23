import { vec2 } from 'gl-matrix';
import { CharacterTeam, Id, MinimapPlayer, settings } from 'shared';

export class Minimap {
  public readonly element = document.createElement('canvas');

  private readonly ctx: CanvasRenderingContext2D;
  private readonly colors: Record<CharacterTeam, string>;
  private readonly smoothed = new Map<Id, vec2>();
  private bufferSize = 0;

  constructor() {
    this.element.className = 'minimap';
    this.ctx = this.element.getContext('2d')!;

    const theme = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) =>
      theme.getPropertyValue(name).trim() || fallback;
    this.colors = {
      [CharacterTeam.blue]: read('--bright-blue', '#4069a5'),
      [CharacterTeam.red]: read('--bright-red', '#d15652'),
      [CharacterTeam.neutral]: read('--bright-neutral', '#ccc'),
    };
  }

  public update(localPosition: vec2 | undefined, players: Array<MinimapPlayer>) {
    const size = this.element.clientWidth;
    if (size === 0) {
      return;
    }
    this.syncBufferSize(size);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, size, size);

    const center = size / 2;
    const innerRadius = center - 5;
    const scale = innerRadius / settings.worldRadius;

    const toMap = (world: vec2): { x: number; y: number } => {
      let dx = world[0] * scale;
      let dy = -world[1] * scale;
      const distance = Math.hypot(dx, dy);
      if (distance > innerRadius) {
        dx = (dx / distance) * innerRadius;
        dy = (dy / distance) * innerRadius;
      }
      return { x: center + dx, y: center + dy };
    };

    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.arc(center, center, 1.5, 0, Math.PI * 2);
    ctx.fill();

    const present = new Set<Id>();
    for (const blip of players) {
      present.add(blip.id);
      let world = this.smoothed.get(blip.id);
      if (world) {
        vec2.lerp(world, world, blip.position, 0.3);
      } else {
        world = vec2.clone(blip.position);
        this.smoothed.set(blip.id, world);
      }
      const { x, y } = toMap(world);
      this.drawDot(x, y, 3, this.colors[blip.team]);
    }
    for (const id of this.smoothed.keys()) {
      if (!present.has(id)) {
        this.smoothed.delete(id);
      }
    }

    if (localPosition) {
      const { x, y } = toMap(localPosition);
      this.drawDot(x, y, 3.5, '#ffffff');
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  private drawDot(x: number, y: number, radius: number, color: string) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = radius * 2;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  private syncBufferSize(cssSize: number) {
    const dpr = window.devicePixelRatio || 1;
    const target = Math.round(cssSize * dpr);
    if (this.bufferSize !== target) {
      this.bufferSize = target;
      this.element.width = target;
      this.element.height = target;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}
