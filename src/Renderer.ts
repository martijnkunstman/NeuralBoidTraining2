import { Vehicle } from './Vehicle';
import { Brain } from './Brain';
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

    render(world: World) {
        if (!world.vehicles || world.vehicles.length === 0) return;

        // Clear
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();

        // Camera transform
        const scale = world.camera.zoom;
        const camX = world.camera.x;
        const camY = world.camera.y;

        this.ctx.translate(this.width / 2, this.height / 2);
        this.ctx.scale(scale, scale);
        this.ctx.translate(-camX, -camY);

        // Grid
        this.drawGrid(camX, camY, scale);

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

                // 4. Edit Mode Visualization
                if (world.track.isEditing) {
                    this.ctx.setLineDash([]);

                    // Draw Control Polygon
                    this.ctx.strokeStyle = '#555';
                    this.ctx.lineWidth = 0.5;
                    this.ctx.beginPath();
                    const cp = world.track.controlPoints;
                    if (cp.length > 0) {
                        this.ctx.moveTo(cp[0].x, cp[0].y);
                        for (let i = 1; i < cp.length; i++) {
                            this.ctx.lineTo(cp[i].x, cp[i].y);
                        }
                        this.ctx.closePath();
                    }
                    this.ctx.stroke();

                    // Draw Control Points
                    for (let i = 0; i < cp.length; i++) {
                        const p = cp[i];
                        this.ctx.beginPath();
                        this.ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);

                        if (i === world.track.selectedPointIndex) {
                            this.ctx.fillStyle = '#ff0000';
                            this.ctx.fill();
                            this.ctx.strokeStyle = '#fff';
                            this.ctx.stroke();
                        } else if (i === world.track.hoveredPointIndex) {
                            this.ctx.fillStyle = '#ffaa00';
                            this.ctx.fill();
                        } else {
                            this.ctx.fillStyle = '#00ff00';
                            this.ctx.fill();
                        }
                    }
                }
                this.ctx.restore();
            }
        }

        // Draw Vehicles if not editing
        if (world.track && !world.track.isEditing) {
            for (const vehicle of world.vehicles) {
                const isBest = vehicle === world.bestVehicle && vehicle.isAlive;
                this.drawVehicle(vehicle, isBest);
            }
        }

        this.ctx.restore(); // Undo camera

        // HUD
        this.drawHUD(world);
        this.drawMinimap(world);
        if (world.bestVehicle && world.bestVehicle.brain) {
            this.drawBrain(world.bestVehicle.brain);
        }
    }

    drawVehicle(vehicle: Vehicle, isBest: boolean) {
        this.ctx.save();
        const { translation, rotation } = vehicle.getTransform();
        this.ctx.translate(translation.x, translation.y);
        this.ctx.rotate(rotation);

        // Draw Triangle
        const vLength = vehicle.length;
        const vWidth = vehicle.width;

        // Color based on status
        if (!vehicle.isAlive) {
            this.ctx.fillStyle = '#ff0000'; // Red for dead
        } else if (isBest) {
            this.ctx.fillStyle = '#00ff00'; // Green for best
            this.ctx.strokeStyle = '#ffff00'; // Yellow outline
            this.ctx.lineWidth = 0.3;
        } else {
            this.ctx.fillStyle = '#888888'; // Gray for others
        }

        this.ctx.beginPath();
        this.ctx.moveTo(vLength / 2, 0);
        this.ctx.lineTo(-vLength / 2, vWidth / 2);
        this.ctx.lineTo(-vLength / 2, -vWidth / 2);
        this.ctx.closePath();
        this.ctx.fill();

        if (isBest && vehicle.isAlive) {
            this.ctx.stroke();
        }

        this.ctx.restore();

        // Draw Sensors only for best vehicle if alive
        if (isBest && vehicle.isAlive && vehicle.sensors && vehicle.sensors.length > 0) {
            this.ctx.lineWidth = 0.1;

            for (const sensor of vehicle.sensors) {
                let alpha = 0.1;

                if (sensor.hit) {
                    const dist = Math.min(sensor.hit.distance, vehicle.sensorLength);
                    const ratio = dist / vehicle.sensorLength;
                    alpha = 1.0 - (ratio * 0.9);
                }

                this.ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;

                this.ctx.beginPath();
                this.ctx.moveTo(sensor.start.x, sensor.start.y);
                this.ctx.lineTo(sensor.end.x, sensor.end.y);
                this.ctx.stroke();

                // Draw points at ends
                if (sensor.hit) {
                    this.ctx.fillStyle = '#ff0000';
                    this.ctx.beginPath();
                    this.ctx.arc(sensor.end.x, sensor.end.y, 0.3, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }
    }

    drawHUD(world: World) {
        this.ctx.fillStyle = 'white';
        this.ctx.font = '16px monospace';

        const aliveCount = world.vehicles.filter(v => v.isAlive).length;
        const totalCount = world.vehicles.length;

        // Generation info
        this.ctx.fillText(`Generation: ${world.generation}`, 10, 20);

        // Timer
        const timeLeft = Math.max(0, world.generationTime - world.generationTimer);
        this.ctx.fillText(`Time: ${timeLeft.toFixed(1)}s`, 10, 40);

        // Alive count
        this.ctx.fillText(`Alive: ${aliveCount} / ${totalCount}`, 10, 60);

        if (world.bestVehicle) {
            const bestFitness = world.bestVehicle.distanceTraveled;
            this.ctx.fillText(`Best: ${bestFitness.toFixed(2)}`, 10, 80);

            const vel = world.bestVehicle.getVelocity();
            const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
            this.ctx.fillText(`Speed: ${speed.toFixed(2)}`, 10, 100);
        }

        // All-time best
        if (world.bestFitnessEver > 0) {
            this.ctx.fillStyle = '#ffff00';
            this.ctx.fillText(`All-Time Best: ${world.bestFitnessEver.toFixed(2)}`, 10, 130);
        }
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

    drawMinimap(world: World) {
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

        // Helper to map world to minimap
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

        // Draw all vehicles on minimap
        for (const vehicle of world.vehicles) {
            const vPos = vehicle.body.translation();
            let dotX = mapX(vPos.x);
            let dotY = mapY(vPos.y);

            // Clamp to minimap
            dotX = Math.max(x, Math.min(x + miniMapSize, dotX));
            dotY = Math.max(y, Math.min(y + miniMapSize, dotY));

            // Color based on status
            if (!vehicle.isAlive) {
                this.ctx.fillStyle = '#ff0000'; // Red for dead
                this.ctx.beginPath();
                this.ctx.arc(dotX, dotY, 1, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (vehicle === world.bestVehicle) {
                this.ctx.fillStyle = '#00ff00'; // Green for best
                this.ctx.beginPath();
                this.ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
                this.ctx.fill();

                // Add ring around best
                this.ctx.strokeStyle = '#ffff00';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
                this.ctx.stroke();
            } else {
                this.ctx.fillStyle = '#888888'; // Gray for others
                this.ctx.beginPath();
                this.ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    drawBrain(brain: Brain) {
        const startX = 50;
        const startY = this.height - 250;
        const width = 300;
        const height = 200;

        const levelCount = brain.levels.length;

        // Helper to get node position
        const getNodePos = (levelIndex: number, nodeIndex: number, totalNodes: number) => {
            const x = startX + (width / levelCount) * levelIndex;
            // Center nodes vertically
            // const spacing = height / (totalNodes + 1); // +1 prevents hitting edges
            // Or spread more evenly: 
            // const spacing = height / totalNodes;
            // const y = startY + spacing * nodeIndex + spacing / 2;

            // Let's use available height
            const step = height / (totalNodes - 1 || 1);
            const totalH = step * (totalNodes - 1);
            const yOffset = (height - totalH) / 2;
            const y = startY + yOffset + step * nodeIndex;

            return { x, y };
        };

        // Draw Levels
        for (let i = 0; i < brain.levels.length; i++) {
            const level = brain.levels[i];
            const inputs = level.inputs;
            const outputs = level.outputs;
            const weights = level.weights;
            // const biases = level.biases;

            // Draw Connections
            for (let j = 0; j < inputs.length; j++) {
                for (let k = 0; k < outputs.length; k++) {
                    const weight = weights[j][k];
                    this.ctx.beginPath();
                    const start = getNodePos(i, j, inputs.length);
                    const end = getNodePos(i + 1, k, outputs.length);
                    this.ctx.moveTo(start.x, start.y);
                    this.ctx.lineTo(end.x, end.y);

                    this.ctx.lineWidth = Math.abs(weight) * 2;
                    // Color based on weight sign
                    if (weight > 0) {
                        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
                    } else {
                        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
                    }
                    this.ctx.stroke();
                }
            }
        }

        // Draw Nodes
        // We iterate through levels. 
        // For each level i, we draw its inputs.
        // For the last level, we also draw its outputs.

        for (let i = 0; i < brain.levels.length; i++) {
            const level = brain.levels[i];
            const inputs = level.inputs;

            for (let j = 0; j < inputs.length; j++) {
                const pos = getNodePos(i, j, inputs.length);
                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);

                // Visualization of activation
                // Inputs might not be 0-1 if they are sensor distances.
                // But generally 0-1 is expected for NN inputs.
                // Let's assume they are somewhat normalized or just visualize value.
                const val = inputs[j];
                this.ctx.fillStyle = `rgba(255, 255, 255, ${val})`;
                this.ctx.fill();

                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();

                // Input Labels (optional, maybe for first layer)
                if (i === 0) {
                    // Label sensors?
                }
            }
        }

        // Draw Output Nodes of last level
        const lastLevel = brain.levels[brain.levels.length - 1];
        const outputs = lastLevel.outputs;
        for (let k = 0; k < outputs.length; k++) {
            const pos = getNodePos(levelCount, k, outputs.length);
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);

            const val = outputs[k];
            // Since we used Sigmoid, val is 0-1
            this.ctx.fillStyle = `rgba(255, 255, 255, ${val})`;
            this.ctx.fill();

            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();

            // Output Labels
            this.ctx.fillStyle = 'white';
            this.ctx.font = '10px monospace';
            const labels = ['L', 'R', 'F'];
            // My brain output mapping: [Left, Right, Forward] or similar?
            // User said: "left right forward as output"
            // So index 0: Left, 1: Right, 2: Forward
            if (k < labels.length) {
                this.ctx.fillText(labels[k], pos.x + 10, pos.y + 3);
            }
        }
    }
}

