import { holdDurationToCharge } from 'shared';
import { pointer } from './helper/pointer';

let element: HTMLElement | undefined;
let heldSince = 0;
let raf = 0;
let isFollowingPointer = false;

function beginChargeIndicator(x: number, y: number, followPointer = false) {
  endChargeIndicator();

  const el = document.createElement('div');
  el.className = 'charge-ring';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);

  element = el;
  heldSince = performance.now();
  isFollowingPointer = followPointer;
  raf = requestAnimationFrame(updateChargeIndicator);
}

function endChargeIndicator() {
  if (element) {
    cancelAnimationFrame(raf);
    element.parentElement?.removeChild(element);
    element = undefined;
  }
}

function updateChargeIndicator() {
  if (!element) {
    return;
  }

  const charge = holdDurationToCharge((performance.now() - heldSince) / 1000);
  element.style.opacity = charge < 0.12 ? '0' : '1';
  element.style.background = `conic-gradient(rgba(255, 255, 255, 0.85) ${
    charge * 360
  }deg, rgba(255, 255, 255, 0.15) 0deg)`;
  element.classList.toggle('full', charge >= 1);

  if (isFollowingPointer) {
    const cursor = pointer.displayPosition;
    if (cursor) {
      element.style.left = `${cursor.x}px`;
      element.style.top = `${cursor.y}px`;
    }
  }

  raf = requestAnimationFrame(updateChargeIndicator);
}

// The one public surface; the functions above stay module-private.
export const ChargeIndicator = {
  begin: beginChargeIndicator,
  end: endChargeIndicator,
};
