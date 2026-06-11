import { holdDurationToCharge } from 'shared';
import { Pointer } from './helper/pointer';


export abstract class ChargeIndicator {
  private static element?: HTMLElement;
  private static heldSince = 0;
  private static raf = 0;
  private static followPointer = false;

  public static begin(x: number, y: number, followPointer = false) {
    this.end();

    const element = document.createElement('div');
    element.className = 'charge-ring';
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    document.body.appendChild(element);

    this.element = element;
    this.heldSince = performance.now();
    this.followPointer = followPointer;
    this.raf = requestAnimationFrame(this.update);
  }

  public static end() {
    if (this.element) {
      cancelAnimationFrame(this.raf);
      this.element.parentElement?.removeChild(this.element);
      this.element = undefined;
    }
  }

  private static update = () => {
    const element = ChargeIndicator.element;
    if (!element) {
      return;
    }

    const charge = holdDurationToCharge(
      (performance.now() - ChargeIndicator.heldSince) / 1000,
    );
    element.style.opacity = charge < 0.12 ? '0' : '1';
    element.style.background = `conic-gradient(rgba(255, 255, 255, 0.85) ${charge * 360
      }deg, rgba(255, 255, 255, 0.15) 0deg)`;
    element.classList.toggle('full', charge >= 1);

    if (ChargeIndicator.followPointer) {
      const cursor = Pointer.getDisplayPosition();
      if (cursor) {
        element.style.left = `${cursor.x}px`;
        element.style.top = `${cursor.y}px`;
      }
    }

    ChargeIndicator.raf = requestAnimationFrame(ChargeIndicator.update);
  };
}
