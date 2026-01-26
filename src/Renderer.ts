import { Vehicle } from './Vehicle';
import { Input } from './Input';

export class Renderer {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;

    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d')!;
        document.body.appendChild(this.canvas);

        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        window.addEventListener('resize', () => {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.canvas.width = this.width;
            this.canvas.height = this.height;
        });
    }

    render(vehicle: Vehicle, input: Input) {
        // Clear
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();

        // Camera transform: Center on vehicle
        const { translation, rotation } = vehicle.getTransform();

        this.ctx.translate(this.width / 2, this.height / 2);
        // Inverse translation to keep vehicle center?
        // User wants "move vehicle around". Usually means camera follows.
        // So we translate world so vehicle is at 0,0 (relative to camera center).
        // Actually, let's keep vehicle at center.
        // World moves opposite to vehicle.

        // Grid (optional, helps see movement)
        this.drawGrid(translation.x, translation.y);

        // Draw Vehicle (at 0,0 local space, but rotated)
        this.ctx.save();
        this.ctx.rotate(rotation);

        // Draw Triangle
        this.ctx.beginPath();
        const vLength = vehicle.length;
        const vWidth = vehicle.width;
        // Same points as collider
        // (Length/2, 0), (-Length/2, Width/2), (-Length/2, -Width/2)
        // Scale for visibility (Rapier units are small, meters. Pixels are small. Need Zoom).
        const scale = 20; // 20 pixels per meter

        this.ctx.scale(scale, scale);

        this.ctx.fillStyle = '#ff6347';
        this.ctx.beginPath();
        this.ctx.moveTo(vLength / 2, 0);
        this.ctx.lineTo(-vLength / 2, vWidth / 2);
        this.ctx.lineTo(-vLength / 2, -vWidth / 2);
        this.ctx.closePath();
        this.ctx.fill();

        // Draw Debug Inputs (Blue points)
        this.ctx.fillStyle = '#00bfff'; // Deep Sky Blue
        const pointSize = 0.2;

        if (input.isDown('ArrowUp')) {
            this.ctx.beginPath();
            this.ctx.arc(vLength / 2 + 0.5, 0, pointSize, 0, Math.PI * 2);
            this.ctx.fill();
        }
        if (input.isDown('ArrowDown')) {
            this.ctx.beginPath();
            this.ctx.arc(-vLength / 2 - 0.5, 0, pointSize, 0, Math.PI * 2);
            this.ctx.fill();
        }
        if (input.isDown('ArrowLeft')) {
            this.ctx.beginPath();
            this.ctx.arc(-vLength / 2, -vWidth / 2 - 0.5, pointSize, 0, Math.PI * 2);
            this.ctx.fill();
        }
        if (input.isDown('ArrowRight')) {
            this.ctx.beginPath();
            this.ctx.arc(-vLength / 2, vWidth / 2 + 0.5, pointSize, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore(); // Undo rotation/scale for vehicle

        // Draw Velocity Vector
        const vel = vehicle.getVelocity();
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        if (speed > 0.1) {
            this.ctx.save();
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            // Velocity visualization
            // The velocity is in world space. We are in camera space (centered on vehicle).
            // Since we didn't rotate the whole world context, just the vehicle context,
            // we can apply world space rotation?
            // Wait, I translated `this.ctx.translate(this.width / 2, this.height / 2)`.
            // Then I did NOT rotate/translate for world position yet.
            // So I am drawing in "screen" space centered.
            // The vehicle is drawn rotated.
            // The Velocity vector is World Space relative directions.
            // If I draw it here, I should rotate it by -rotation if I want it relative to vehicle body?
            // Or if I want to show world velocity vector relative to screen?
            // "Visualise velocity angle and strenght".
            // Let's draw it from the center.
            // Since the camera is static relative to vehicle orientation? No, usually camera doesn't rotate with vehicle in top down unless specified.
            // I implemented: Camera follows Position, but NOT Rotation (Standard top down).
            // So Vehicle rotates on screen.
            // So Velocity vector (World Space) can be drawn directly.
            // But need to scale it.
            const scale = 20;
            this.ctx.lineTo(vel.x * scale, vel.y * scale);
            this.ctx.stroke();
            this.ctx.restore();
        }

        this.ctx.restore(); // Restore to screen coordinates

        // HUD
        this.ctx.fillStyle = 'white';
        this.ctx.font = '16px monospace';
        this.ctx.fillText(`Speed: ${speed.toFixed(2)}`, 10, 20);
        this.ctx.fillText(`Pos: ${translation.x.toFixed(2)}, ${translation.y.toFixed(2)}`, 10, 40);
    }

    drawGrid(camX: number, camY: number) {
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;

        const scale = 20; // Pixels per meter
        const gridSize = 5; // Meters per grid line interval
        const scaledGridSize = gridSize * scale; // Pixels per grid line interval

        const worldOffsetX = camX * scale;
        const worldOffsetY = camY * scale;

        // Calculate the starting point for drawing grid lines
        // We want the grid lines to align with world coordinates, so we need to find the first grid line
        // that is visible on screen, relative to the current camera position.
        const startX = Math.floor((worldOffsetX - this.width / 2) / scaledGridSize) * scaledGridSize;
        const startY = Math.floor((worldOffsetY - this.height / 2) / scaledGridSize) * scaledGridSize;

        this.ctx.save();
        this.ctx.beginPath();

        // Draw vertical lines
        for (let x = startX; x < worldOffsetX + this.width / 2 + scaledGridSize; x += scaledGridSize) {
            this.ctx.moveTo(x - worldOffsetX, -this.height / 2);
            this.ctx.lineTo(x - worldOffsetX, this.height / 2);
        }

        // Draw horizontal lines
        for (let y = startY; y < worldOffsetY + this.height / 2 + scaledGridSize; y += scaledGridSize) {
            this.ctx.moveTo(-this.width / 2, y - worldOffsetY);
            this.ctx.lineTo(this.width / 2, y - worldOffsetY);
        }

        this.ctx.stroke();
        this.ctx.restore();
    }
}
