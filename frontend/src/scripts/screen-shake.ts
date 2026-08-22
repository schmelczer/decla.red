let trauma = 0;
let punch = 0;

const maxTranslation = 150;
const maxZoom = 0.07;
const traumaDecayPerSecond = 1.7;
const punchDecayPerSecond = 6;

let offsetXValue = 0;
let offsetYValue = 0;

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function addTrauma(t: number): void {
  if (reducedMotion()) {
    return;
  }
  trauma = Math.min(1, trauma + t);
}

export function addPunch(amount: number): void {
  if (reducedMotion()) {
    return;
  }
  punch = Math.min(1, punch + amount);
}

export function stepScreenShake(deltaTimeInSeconds: number): void {
  trauma = Math.max(0, trauma - traumaDecayPerSecond * deltaTimeInSeconds);
  punch = Math.max(0, punch - punchDecayPerSecond * deltaTimeInSeconds);
  const shake = trauma * trauma;
  offsetXValue = maxTranslation * shake * (Math.random() * 2 - 1);
  offsetYValue = maxTranslation * shake * (Math.random() * 2 - 1);
}

function getOffsetX(): number {
  return offsetXValue;
}

function getOffsetY(): number {
  return offsetYValue;
}

function getViewScale(): number {
  return 1 - maxZoom * punch * punch;
}

export function resetScreenShake(): void {
  trauma = 0;
  punch = 0;
  offsetXValue = 0;
  offsetYValue = 0;
}

export const ScreenShake = {
  add: addTrauma,
  addPunch,
  step: stepScreenShake,
  get offsetX() {
    return getOffsetX();
  },
  get offsetY() {
    return getOffsetY();
  },
  get viewScale() {
    return getViewScale();
  },
  reset: resetScreenShake,
};
