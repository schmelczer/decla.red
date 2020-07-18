export class KeyboardListener {
  private keysDown: Set<string> = new Set();

  constructor() {
    document.addEventListener('keydown', (event) => {
      this.keysDown.add(event.key);
    });

    document.addEventListener('keyup', (event) => {
      this.keysDown.delete(event.key);
    });
  }

  isKeyDown(key: string): boolean {
    return (
      this.keysDown.has(key) ||
      this.keysDown.has(key.toLowerCase()) ||
      this.keysDown.has(key.toUpperCase())
    );
  }
}
