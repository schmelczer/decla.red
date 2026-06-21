import { settings } from 'shared';
import { Pointer } from './helper/pointer';

export abstract class FeedbackHud {
  private static root?: HTMLElement;
  private static killfeed?: HTMLElement;
  private static elimination?: HTMLElement;

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

  public static hitMarker(charge = 0) {
    const { x, y } = this.focusPoint();
    const marker = document.createElement('div');
    marker.className =
      'hitmarker' + (charge >= settings.chargedHitThreshold ? ' charged' : '');
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    this.addTransient(marker, 250);
  }

  public static killConfirmed(victimName?: string, streak = 1, charge = 0) {
    const { killfeed } = this.ensureRoot();
    const charged = charge >= settings.chargedHitThreshold;

    // A quick crimson vignette pulse around the whole frame to punctuate the kill.
    const flash = document.createElement('div');
    flash.className = 'kill-flash' + (charged ? ' charged' : '');
    this.addTransient(flash, 420);

    const entry = document.createElement('div');
    entry.className = 'kill-entry';
    entry.innerHTML = `Eliminated <b>${this.escape(victimName ?? 'enemy')}</b>`;
    killfeed.insertBefore(entry, killfeed.firstChild);
    setTimeout(() => entry.parentElement?.removeChild(entry), 4500);

    const { x, y } = this.focusPoint();
    const popup = document.createElement('div');
    popup.className = 'kill-popup' + (charged ? ' charged' : '');
    popup.innerHTML = `+${settings.playerKillPoint} <span class="heal">+${settings.playerKillHealthReward}❤</span>`;
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    this.addTransient(popup, 1200);

    const callout = this.streakName(streak) ?? (charged ? 'Charged Kill!' : undefined);
    if (callout) {
      const el = document.createElement('div');
      el.className = 'streak-callout';
      el.innerText = callout;
      this.addTransient(el, 1400);
    }
  }

  // Persistent centred overlay shown while the local player is dead and waiting
  // to respawn. The countdown itself is the server-driven "Reviving in N…"
  // announcement; this makes the death state unmistakable and stays up until
  // hideElimination() is called on respawn.
  public static showElimination(): void {
    if (this.elimination) {
      return;
    }
    const { root } = this.ensureRoot();
    const el = document.createElement('div');
    el.className = 'elimination';
    el.innerHTML =
      '<div class="elimination-title">Eliminated</div>' +
      '<div class="elimination-sub">Respawning…</div>';
    root.appendChild(el);
    this.elimination = el;
  }

  public static hideElimination(): void {
    this.elimination?.parentElement?.removeChild(this.elimination);
    this.elimination = undefined;
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
