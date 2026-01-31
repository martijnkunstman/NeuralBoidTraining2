export class Input {
    keys: Set<string> = new Set();
    keysPressed: Set<string> = new Set();
    mouseX: number = 0;
    mouseY: number = 0;
    isMouseDown: boolean = false;
    mouseClicked: boolean = false;

    constructor() {
        window.addEventListener('keydown', (e) => {
            this.keys.add(e.code);
            if (!e.repeat) this.keysPressed.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));

        window.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });

        window.addEventListener('mousedown', (e) => {
            this.isMouseDown = true;
            this.mouseClicked = true;
        });

        window.addEventListener('mouseup', (e) => {
            this.isMouseDown = false;
        });
    }

    isDown(code: string): boolean {
        return this.keys.has(code);
    }

    isPressed(code: string): boolean {
        return this.keysPressed.has(code);
    }

    // Call this at end of frame to clear one-shot states
    reset() {
        this.mouseClicked = false;
        this.keysPressed.clear();
    }
}
