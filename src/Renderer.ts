import { Vehicle } from './Vehicle';
import { Input } from './Input';
import { World } from './World';

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

    render(world: World, input: Input) {
        const vehicle = world.vehicle;
        // Clear
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();

        // Camera transform: Center on vehicle
        const { translation, rotation } = vehicle.getTransform();
        const scale = 10;

        this.ctx.translate(this.width / 2, this.height / 2);
        this.ctx.scale(scale, scale);
        // Important: Translate world opposite to vehicle position
        this.ctx.translate(-translation.x, -translation.y);

        // Grid
        this.drawGrid(translation.x, translation.y, scale);

        // Draw Track (Visuals)
        if (world.track) {
            const path = world.track.path;
            if (path.length > 0) {
                this.ctx.save();
                this.ctx.lineJoin = 'round';
                this.ctx.lineCap = 'round';

                // Track Width (Asphalt)
                const trackWidth = world.track.trackWidth;

                // 1. Draw Border (White)
                this.ctx.strokeStyle = '#ddd';
                this.ctx.lineWidth = trackWidth + 2;
                this.ctx.beginPath();
                this.ctx.moveTo(path[0].x, path[0].y);
                for (let i = 1; i < path.length; i++) {
                    this.ctx.lineTo(path[i].x, path[i].y);
                }
                this.ctx.closePath();
                this.ctx.stroke();

                // 2. Draw Asphalt (Dark Grey)
                this.ctx.strokeStyle = '#333';
                this.ctx.lineWidth = trackWidth;
                this.ctx.stroke();

                // 3. Centerline (Dashed Yellow)
                this.ctx.strokeStyle = '#cc0'; // Yellowish
                this.ctx.lineWidth = 0.5;
                this.ctx.setLineDash([2, 3]);
                this.ctx.stroke();

                this.ctx.restore();
            }
        }

        // Draw Vehicle
        this.ctx.save();
        this.ctx.translate(translation.x, translation.y);
        this.ctx.rotate(rotation);

        // Draw Triangle
        const vLength = vehicle.length;
        const vWidth = vehicle.width;

        this.ctx.fillStyle = '#ff6347';
        this.ctx.beginPath();
        this.ctx.moveTo(vLength / 2, 0);
        this.ctx.lineTo(-vLength / 2, vWidth / 2);
        this.ctx.lineTo(-vLength / 2, -vWidth / 2);
        this.ctx.closePath();
        this.ctx.fill();

        // Debug Inputs
        const pointSize = 0.2;
        this.ctx.fillStyle = '#00bfff';
        if (input.isDown('ArrowUp')) {
            this.ctx.beginPath(); this.ctx.arc(vLength / 2 + 0.5, 0, pointSize, 0, Math.PI * 2); this.ctx.fill();
        }
        if (input.isDown('ArrowDown')) {
            this.ctx.beginPath(); this.ctx.arc(-vLength / 2 - 0.5, 0, pointSize, 0, Math.PI * 2); this.ctx.fill();
        }
        if (input.isDown('ArrowLeft')) {
            this.ctx.beginPath(); this.ctx.arc(-vLength / 2, -vWidth / 2 - 0.5, pointSize, 0, Math.PI * 2); this.ctx.fill();
        }
        if (input.isDown('ArrowRight')) {
            this.ctx.beginPath(); this.ctx.arc(-vLength / 2, vWidth / 2 + 0.5, pointSize, 0, Math.PI * 2); this.ctx.fill();
        }

        this.ctx.restore();

        // Draw Velocity Vector
        const vel = vehicle.getVelocity();
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        if (speed > 0.1) {
            this.ctx.save();
            this.ctx.translate(translation.x, translation.y);
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 0.2;
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(vel.x, vel.y);
            this.ctx.stroke();
            this.ctx.restore();
        }

        this.ctx.restore(); // Undo camera

        // HUD
        this.ctx.fillStyle = 'white';
        this.ctx.font = '16px monospace';
        this.ctx.fillText(`Speed: ${speed.toFixed(2)}`, 10, 20);
        this.ctx.fillText(`Pos: ${translation.x.toFixed(2)}, ${translation.y.toFixed(2)}`, 10, 40);

        this.drawMinimap(world, vehicle);
    }

    drawGrid(camX: number, camY: number, scale: number) {
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1 / scale;

        const gridSize = (5 / 3) * 4;

        const viewW = this.width / scale;
        const viewH = this.height / scale;

        const startX = Math.floor((camX - viewW / 2) / gridSize) * gridSize;
        const startY = Math.floor((camY - viewH / 2) / gridSize) * gridSize;

        const endX = camX + viewW / 2;
        const endY = camY + viewH / 2;

        this.ctx.beginPath();

        for (let x = startX; x <= endX + gridSize; x += gridSize) {
            this.ctx.moveTo(x, camY - viewH / 2);
            this.ctx.lineTo(x, camY + viewH / 2);
        }

        for (let y = startY; y <= endY + gridSize; y += gridSize) {
            this.ctx.moveTo(camX - viewW / 2, y);
            this.ctx.lineTo(camX + viewW / 2, y);
        }

        this.ctx.stroke();
    }

    drawMinimap(world: World, vehicle: Vehicle) {
        const miniMapSize = 150;
        const padding = 20;
        const x = this.width - miniMapSize - padding;
        const y = this.height - miniMapSize - padding;

        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(x, y, miniMapSize, miniMapSize);
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, miniMapSize, miniMapSize);

        const worldW = world.width;
        const worldH = world.height;
        const vPos = vehicle.body.translation();

        const mapX = (wx: number) => x + ((wx + worldW / 2) / worldW) * miniMapSize;
        const mapY = (wy: number) => y + ((wy + worldH / 2) / worldH) * miniMapSize;

        // Draw Track Visuals on Minimap
        if (world.track) {
            const path = world.track.path;
            if (path.length > 0) {
                this.ctx.save();
                this.ctx.strokeStyle = '#888';
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();

                const p0 = path[0];
                this.ctx.moveTo(mapX(p0.x), mapY(p0.y));
                for (let i = 1; i < path.length; i++) {
                    const p = path[i];
                    this.ctx.lineTo(mapX(p.x), mapY(p.y));
                }
                this.ctx.closePath();
                this.ctx.stroke();
                this.ctx.restore();
            }
        }

        // Draw Vehicle dot
        let dotX = mapX(vPos.x);
        let dotY = mapY(vPos.y);

        dotX = Math.max(x, Math.min(x + miniMapSize, dotX));
        dotY = Math.max(y, Math.min(y + miniMapSize, dotY));

        this.ctx.fillStyle = '#ff6347';
        this.ctx.beginPath();
        this.ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
        this.ctx.fill();
    }
}
