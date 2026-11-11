let virtualCursor: HTMLElement | null = null;

function getOrCreateVirtualCursor(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const bodyHasContains = typeof document.body?.contains === 'function';
  if (!virtualCursor || (bodyHasContains && !document.body.contains(virtualCursor))) {
    virtualCursor = document.getElementById('study-assistant-virtual-cursor');
    if (!virtualCursor && document.body) {
      try {
        virtualCursor = document.createElement('div');
        virtualCursor.id = 'study-assistant-virtual-cursor';
        virtualCursor.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: radial-gradient(circle, #818cf8 0%, #4f46e5 70%);
          border: 2px solid #ffffff;
          box-shadow: 0 0 14px rgba(99, 102, 241, 0.9), 0 0 4px rgba(0, 0, 0, 0.6);
          pointer-events: none;
          z-index: 2147483647;
          transition: transform 0.04s linear, background 0.15s ease;
          transform: translate(-100px, -100px);
          opacity: 0.92;
        `;
        const dot = document.createElement('div');
        dot.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          width: 4px;
          height: 4px;
          background: #ffffff;
          border-radius: 50%;
          transform: translate(-50%, -50%);
        `;
        if (typeof virtualCursor.appendChild === 'function') {
          virtualCursor.appendChild(dot);
        }
        if (typeof document.body.appendChild === 'function') {
          document.body.appendChild(virtualCursor);
        }
      } catch {
        virtualCursor = null;
      }
    }
  }
  return virtualCursor;
}

export class HumanEngine {
  private lastX = typeof window !== 'undefined' ? window.innerWidth / 2 : 500;
  private lastY = typeof window !== 'undefined' ? window.innerHeight / 2 : 400;
  private heartbeatInterval: number | null = null;

  public randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  public sleep(minMs: number, maxMs?: number): Promise<void> {
    const delay = maxMs ? this.randInt(minMs, maxMs) : minMs;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  private generateBezierPoints(x1: number, y1: number, x2: number, y2: number, steps: number) {
    const points: Array<{ x: number; y: number }> = [];
    const cp1x = x1 + (x2 - x1) * 0.25 + this.randInt(-30, 30);
    const cp1y = y1 + (y2 - y1) * 0.15 + this.randInt(-30, 30);
    const cp2x = x1 + (x2 - x1) * 0.75 + this.randInt(-20, 20);
    const cp2y = y1 + (y2 - y1) * 0.85 + this.randInt(-20, 20);

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const inv = 1 - t;
      const x = Math.round(
        inv * inv * inv * x1 +
        3 * inv * inv * t * cp1x +
        3 * inv * t * t * cp2x +
        t * t * t * x2
      );
      const y = Math.round(
        inv * inv * inv * y1 +
        3 * inv * inv * t * cp1y +
        3 * inv * t * t * cp2y +
        t * t * t * y2
      );
      points.push({ x, y });
    }
    return points;
  }

  public async moveMouseTo(targetX: number, targetY: number): Promise<void> {
    const steps = this.randInt(12, 22);
    const points = this.generateBezierPoints(this.lastX, this.lastY, targetX, targetY, steps);
    const cursor = getOrCreateVirtualCursor();

    for (const pt of points) {
      if (cursor) {
        cursor.style.transform = `translate(${pt.x - 10}px, ${pt.y - 10}px)`;
      }

      const evtProps = {
        bubbles: true,
        cancelable: true,
        clientX: pt.x,
        clientY: pt.y,
        screenX: pt.x + (typeof window !== 'undefined' ? window.screenX : 0),
        screenY: pt.y + (typeof window !== 'undefined' ? window.screenY + 80 : 80)
      };

      const mouseEvt = new MouseEvent('mousemove', evtProps);
      document.dispatchEvent(mouseEvt);
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(mouseEvt);
      }

      this.lastX = pt.x;
      this.lastY = pt.y;
      await new Promise((r) => setTimeout(r, this.randInt(5, 15)));
    }
  }

  public async naturalClick(element: HTMLElement): Promise<boolean> {
    if (!element) return false;

    try {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.sleep(250, 450);
    } catch {}

    const rect = element.getBoundingClientRect();
    const width = Math.max(rect.width, 10);
    const height = Math.max(rect.height, 10);
    const x = Math.max(0, rect.left + width * (0.3 + Math.random() * 0.4));
    const y = Math.max(0, rect.top + height * (0.3 + Math.random() * 0.4));

    await this.moveMouseTo(x, y);
    await this.sleep(80, 160);

    const cursor = getOrCreateVirtualCursor();
    if (cursor) {
      cursor.style.transform = `translate(${x - 10}px, ${y - 10}px) scale(0.85)`;
      cursor.style.background = '#10b981';
      setTimeout(() => {
        if (cursor) {
          cursor.style.transform = `translate(${x - 10}px, ${y - 10}px) scale(1)`;
          cursor.style.background = 'radial-gradient(circle, #818cf8 0%, #4f46e5 70%)';
        }
      }, 250);
    }

    const eventProps = {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 1
    };

    element.dispatchEvent(new PointerEvent('pointerover', eventProps));
    element.dispatchEvent(new MouseEvent('mouseover', eventProps));
    element.dispatchEvent(new PointerEvent('pointerenter', eventProps));
    element.dispatchEvent(new MouseEvent('mouseenter', eventProps));
    element.dispatchEvent(new PointerEvent('pointerdown', eventProps));
    element.dispatchEvent(new MouseEvent('mousedown', eventProps));
    element.focus?.();

    await this.sleep(50, 100);

    element.dispatchEvent(new PointerEvent('pointerup', eventProps));
    element.dispatchEvent(new MouseEvent('mouseup', eventProps));
    element.dispatchEvent(new MouseEvent('click', eventProps));

    // Also dispatch to window and document to satisfy audit listeners
    const winClick = new MouseEvent('click', eventProps);
    document.dispatchEvent(winClick);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(winClick);
    }

    try {
      element.click();
    } catch {}

    return true;
  }

  public async naturalScroll(): Promise<void> {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (totalHeight <= 0) return;

    let current = window.scrollY;
    let readingCounter = 0;

    while (current < totalHeight - 40) {
      const delta = this.randInt(100, 260);
      window.scrollBy({ top: delta, behavior: 'smooth' });
      current += delta;

      readingCounter++;
      if (readingCounter >= this.randInt(3, 5)) {
        await this.sleep(800, 1800);
        readingCounter = 0;
      } else {
        await this.sleep(100, 220);
      }
    }
  }

  public async naturalType(element: HTMLInputElement | HTMLTextAreaElement, text: string): Promise<void> {
    element.focus();
    await this.sleep(150, 300);

    const proto = element instanceof HTMLTextAreaElement 
      ? window.HTMLTextAreaElement.prototype 
      : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

    let currentVal = element.value || '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      currentVal += char;
      if (nativeSetter) {
        nativeSetter.call(element, currentVal);
      } else {
        element.value = currentVal;
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));

      let delay = this.randInt(25, 70);
      if (char === ' ' || char === '.') delay += this.randInt(50, 120);
      await new Promise((r) => setTimeout(r, delay));
    }
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  public startIdleHeartbeat(): void {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = window.setInterval(async () => {
      // Smooth natural idle exploration across the page viewport
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 800;
      const dx = this.randInt(-80, 80);
      const dy = this.randInt(-60, 60);
      const nx = Math.max(120, Math.min(winW - 120, this.lastX + dx));
      const ny = Math.max(120, Math.min(winH - 120, this.lastY + dy));
      await this.moveMouseTo(nx, ny);
    }, 2800);
  }

  public stopIdleHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export const human = new HumanEngine();
