import { settings } from 'shared';
import { pointer } from './helper/pointer';

let root: HTMLElement | undefined;
let killfeed: HTMLElement | undefined;
let elimination: HTMLElement | undefined;

function ensureRoot(): { root: HTMLElement; killfeed: HTMLElement } {
  if (!root || !killfeed) {
    root = document.createElement('div');
    root.className = 'feedback-hud';

    killfeed = document.createElement('div');
    killfeed.className = 'killfeed';
    root.appendChild(killfeed);

    document.body.appendChild(root);
  }
  return { root, killfeed };
}

function focusPoint(): { x: number; y: number } {
  const cursor = pointer.displayPosition;
  if (cursor) {
    return { x: cursor.x, y: cursor.y };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

function addTransient(el: HTMLElement, lifetimeMs: number) {
  const { root: r } = ensureRoot();
  r.appendChild(el);
  setTimeout(() => el.parentElement?.removeChild(el), lifetimeMs);
}

export function hitMarker(charge = 0) {
  const { x, y } = focusPoint();
  const marker = document.createElement('div');
  marker.className =
    'hitmarker' + (charge >= settings.chargedHitThreshold ? ' charged' : '');
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  addTransient(marker, 250);
}

export function killConfirmed(victimName?: string, streak = 1, charge = 0) {
  const { killfeed: kf } = ensureRoot();
  const charged = charge >= settings.chargedHitThreshold;

  const flash = document.createElement('div');
  flash.className = 'kill-flash' + (charged ? ' charged' : '');
  addTransient(flash, 420);

  const entry = document.createElement('div');
  entry.className = 'kill-entry';
  entry.innerHTML = `Eliminated <b>${escapeHtml(victimName ?? 'enemy')}</b>`;
  kf.insertBefore(entry, kf.firstChild);
  setTimeout(() => entry.parentElement?.removeChild(entry), 4500);

  const { x, y } = focusPoint();
  const popup = document.createElement('div');
  popup.className = 'kill-popup' + (charged ? ' charged' : '');
  popup.innerHTML = `+${settings.playerKillPoint} <span class="heal">+${settings.playerKillHealthReward}❤</span>`;
  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
  addTransient(popup, 1200);

  const callout = streakName(streak) ?? (charged ? 'Charged Kill!' : undefined);
  if (callout) {
    const el = document.createElement('div');
    el.className = 'streak-callout';
    el.innerText = callout;
    addTransient(el, 1400);
  }
}

export function showElimination(): void {
  if (elimination) {
    return;
  }
  const { root: r } = ensureRoot();
  const el = document.createElement('div');
  el.className = 'elimination';
  el.innerHTML =
    '<div class="elimination-title">Eliminated</div>' +
    '<div class="elimination-sub">Respawning…</div>';
  r.appendChild(el);
  elimination = el;
}

export function hideElimination(): void {
  elimination?.parentElement?.removeChild(elimination);
  elimination = undefined;
}

export function resetFeedbackHud(): void {
  hideElimination();
  root?.parentElement?.removeChild(root);
  root = undefined;
  killfeed = undefined;
}

function streakName(streak: number): string | undefined {
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

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

export const FeedbackHud = {
  hitMarker,
  killConfirmed,
  showElimination,
  hideElimination,
  reset: resetFeedbackHud,
};
