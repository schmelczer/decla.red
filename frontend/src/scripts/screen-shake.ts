// Camera impact effects fed by combat hits, sampled by the camera at render
// time. Kept as a process-wide singleton so any view can feed it without
// threading a camera reference through the deserialized object graph. Both
// effects touch only the *rendered* view (centre offset + view-area zoom), never
// the followed position or the simulation clock — so they can't drift the camera
// off the player, and they're completely decoupled from prediction/netcode.
//
// Two effects:
//   - shake: a trauma model (Eiserloh) — the felt shake is trauma SQUARED so
//     small taps stay subtle while a kill punches hard; it bleeds off linearly.
//   - punch: a brief zoom-in on a kill that snaps back fast, for "weight".
//
// Honours prefers-reduced-motion: callers can fire freely and it simply no-ops
// for players who have asked the OS to minimise motion.
export abstract class ScreenShake {
  private static trauma = 0;
  private static punch = 0;

  // Peak translation, in world units, at full trauma. The visible world is
  // ~3800 units wide, so this tops out at a few percent of the screen.
  private static readonly maxTranslation = 150;
  // Fraction the view zooms in at full punch (smaller view area = zoomed in).
  private static readonly maxZoom = 0.07;
  private static readonly traumaDecayPerSecond = 1.7;
  // Snaps back quickly so the punch reads as a sharp bite, not a slow drift.
  private static readonly punchDecayPerSecond = 6;

  private static offsetXValue = 0;
  private static offsetYValue = 0;

  private static get reducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  public static add(trauma: number): void {
    if (this.reducedMotion) {
      return;
    }
    this.trauma = Math.min(1, this.trauma + trauma);
  }

  public static addPunch(amount: number): void {
    if (this.reducedMotion) {
      return;
    }
    this.punch = Math.min(1, this.punch + amount);
  }

  public static step(deltaTimeInSeconds: number): void {
    this.trauma = Math.max(
      0,
      this.trauma - this.traumaDecayPerSecond * deltaTimeInSeconds,
    );
    this.punch = Math.max(0, this.punch - this.punchDecayPerSecond * deltaTimeInSeconds);
    const shake = this.trauma * this.trauma;
    this.offsetXValue = this.maxTranslation * shake * (Math.random() * 2 - 1);
    this.offsetYValue = this.maxTranslation * shake * (Math.random() * 2 - 1);
  }

  public static get offsetX(): number {
    return this.offsetXValue;
  }

  public static get offsetY(): number {
    return this.offsetYValue;
  }

  // Multiplier for the view-area size: <1 zooms in. Squared so the punch bites
  // sharply near its peak rather than ramping linearly.
  public static get viewScale(): number {
    return 1 - this.maxZoom * this.punch * this.punch;
  }

  public static reset(): void {
    this.trauma = 0;
    this.punch = 0;
    this.offsetXValue = 0;
    this.offsetYValue = 0;
  }
}
