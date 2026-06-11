import { settings } from 'shared';
import { Pointer } from './helper/pointer';

// Lightweight, self-managing combat-feedback overlay for the local player:
// hitmarkers, a personal killfeed, multi-kill callouts and a points popup. It
// owns a single fixed, click-through root under <body> and auto-expires every
// element it creates, so callers (CharacterView remote-call handlers) just fire
// and forget — no wiring through the game loop.
export abstract class FeedbackHud {
  private static root?: HTMLElement;
  private static killfeed?: HTMLElement;

  private static ensureRoot(): { root: HTMLElement; killfeed: HTMLElement } {
    if (!this.root || !this.killfeed) {
      this.root = document.createElement('div');
      this.root.className = 'feedback-hud';

      this.killfeed = document.createElement('div');
      this.killfeed.className = 'killfeed';
      this.root.appendChild(this.killfeed);

      document.body.appendChild(this.root);
    }
    return { root: this.root, killfeed: this.killfeed };
  }

  // Where transient marks/popups appear: the cursor on desktop, screen centre on
  // touch (where the local character fires along its facing).
  private static focusPoint(): { x: number; y: number } {
    const cursor = Pointer.getDisplayPosition();
    if (cursor) {
      return { x: cursor.x, y: cursor.y };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  private static addTransient(element: HTMLElement, lifetimeMs: number) {
    const { root } = this.ensureRoot();
    root.appendChild(element);
    setTimeout(() => element.parentElement?.removeChild(element), lifetimeMs);
  }

  // A non-lethal hit landed: a quick crosshair tick at the focus point.
  public static hitMarker() {
    const { x, y } = this.focusPoint();
    const marker = document.createElement('div');
    marker.className = 'hitmarker';
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    this.addTransient(marker, 250);
  }

  // A kill was confirmed: killfeed line, points popup and (for streaks) a callout.
  public static killConfirmed(victimName?: string, streak = 1) {
    const { killfeed } = this.ensureRoot();

    const entry = document.createElement('div');
    entry.className = 'kill-entry';
    entry.innerHTML = `Eliminated <b>${this.escape(victimName ?? 'enemy')}</b>`;
    killfeed.insertBefore(entry, killfeed.firstChild);
    setTimeout(() => entry.parentElement?.removeChild(entry), 4500);

    const { x, y } = this.focusPoint();
    const popup = document.createElement('div');
    popup.className = 'kill-popup';
    popup.innerHTML = `+${settings.playerKillPoint} <span class="heal">+${settings.playerKillHealthReward}❤</span>`;
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    this.addTransient(popup, 1200);

    const callout = this.streakName(streak);
    if (callout) {
      const el = document.createElement('div');
      el.className = 'streak-callout';
      el.innerText = callout;
      this.addTransient(el, 1400);
    }
  }

  private static streakName(streak: number): string | undefined {
    switch (streak) {
      case 2:
        return 'Double Kill!';
      case 3:
        return 'Triple Kill!';
      case 4:
        return 'Quad Kill!';
      default:
        return streak >= 5 ? 'Rampage!' : undefined;
    }
  }

  private static escape(text: string): string {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
  }
}
