import RAPIER from '@dimforge/rapier2d-compat';
import { Input } from './Input';

export class Track {
    world: RAPIER.World;
    walls: RAPIER.RigidBody[] = [];
    trackWidth = 30;
    path: { x: number, y: number }[] = [];
    startPos: { x: number, y: number } = { x: 0, y: 0 };
    innerLoop: { x: number, y: number }[] = [];
    outerLoop: { x: number, y: number }[] = [];

    controlPoints: { x: number, y: number }[] = [];
    isEditing: boolean = false;
    selectedPointIndex: number = -1;
    hoveredPointIndex: number = -1;

    constructor(world: RAPIER.World) {
        this.world = world;
        this.load();

        if (this.controlPoints.length === 0) {
            this.createDefaultTrack();
        } else {
            this.rebuildFunction();
        }
    }

    createDefaultTrack() {
        // Create a simple circle/oval default
        const radius = 100;
        const count = 6;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            this.controlPoints.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        }
        this.rebuildFunction();
    }

    destroy() {
        this.clearPhysics();
    }

    clearPhysics() {
        for (const wall of this.walls) {
            this.world.removeRigidBody(wall);
        }
        this.walls = [];
    }

    save() {
        const data = JSON.stringify(this.controlPoints);
        localStorage.setItem('trackData', data);
        // console.log('Track saved');
    }

    load() {
        const data = localStorage.getItem('trackData');
        if (data) {
            try {
                this.controlPoints = JSON.parse(data);
                // Validate
                if (!Array.isArray(this.controlPoints)) this.controlPoints = [];
            } catch (e) {
                console.error("Failed to load track", e);
                this.controlPoints = [];
            }
        }
    }

    update(input: Input, worldMouse: { x: number, y: number }) {
        if (!this.isEditing) return;

        const captureRadius = 3; // World units

        // Hover check
        let bestDist = captureRadius;
        this.hoveredPointIndex = -1;

        for (let i = 0; i < this.controlPoints.length; i++) {
            const p = this.controlPoints[i];
            const dist = Math.sqrt((p.x - worldMouse.x) ** 2 + (p.y - worldMouse.y) ** 2);
            if (dist < bestDist) {
                bestDist = dist;
                this.hoveredPointIndex = i;
            }
        }

        // Selection / Dragging
        if (input.mouseClicked) {
            if (this.hoveredPointIndex !== -1) {
                this.selectedPointIndex = this.hoveredPointIndex;
            } else {
                // Clicked empty space?
                // Maybe add point? Or deselect?
                // If holding Shift, maybe add point?
                // For now, deselect if clicking void
                this.selectedPointIndex = -1;
            }
        }

        if (input.isMouseDown && this.selectedPointIndex !== -1) {
            this.controlPoints[this.selectedPointIndex].x = worldMouse.x;
            this.controlPoints[this.selectedPointIndex].y = worldMouse.y;
            this.rebuildFunction();
            this.save();
        }

        // Key Commands
        // Delete point ('D')
        if (input.isPressed('KeyD')) {
            if (this.selectedPointIndex !== -1 && this.controlPoints.length > 3) {
                this.controlPoints.splice(this.selectedPointIndex, 1);
                this.selectedPointIndex = -1;
                this.rebuildFunction();
                this.save();
            }
        }

        // Add point ('A')
        if (input.isPressed('KeyA')) {
            this.insertPointAt(worldMouse);
        }
    }

    insertPointAt(pos: { x: number, y: number }) {
        if (this.controlPoints.length < 2) {
            this.controlPoints.push({ ...pos });
            this.rebuildFunction();
            this.save();
            return;
        }

        // Find nearest segment
        let bestIdx = -1;
        let bestDist = Number.MAX_VALUE;

        for (let i = 0; i < this.controlPoints.length; i++) {
            const p1 = this.controlPoints[i];
            const p2 = this.controlPoints[(i + 1) % this.controlPoints.length];

            // Point to Segment distance
            const l2 = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
            let distSq = 0;

            if (l2 === 0) {
                distSq = (pos.x - p1.x) ** 2 + (pos.y - p1.y) ** 2;
            } else {
                let t = ((pos.x - p1.x) * (p2.x - p1.x) + (pos.y - p1.y) * (p2.y - p1.y)) / l2;
                t = Math.max(0, Math.min(1, t));
                const projX = p1.x + t * (p2.x - p1.x);
                const projY = p1.y + t * (p2.y - p1.y);
                distSq = (pos.x - projX) ** 2 + (pos.y - projY) ** 2;
            }

            if (distSq < bestDist) {
                bestDist = distSq;
                bestIdx = i;
            }
        }

        if (bestIdx !== -1) {
            // Insert after bestIdx (between i and i+1)
            this.controlPoints.splice(bestIdx + 1, 0, { ...pos });
            this.selectedPointIndex = bestIdx + 1; // Select the new point
            this.rebuildFunction();
            this.save();
        }
    }

    rebuildFunction() {
        // Generate Spline Path
        this.path = this.generateSpline(this.controlPoints);
        if (this.path.length > 0) {
            this.startPos = this.path[0];
        }

        // Generate Walls
        this.innerLoop = [];
        this.outerLoop = [];

        const halfWidth = (this.trackWidth / 2);

        for (let i = 0; i < this.path.length; i++) {
            const p0 = this.path[(i - 1 + this.path.length) % this.path.length];
            const p1 = this.path[i];
            const p2 = this.path[(i + 1) % this.path.length];

            // Tangent/Normal
            // Use Centered Difference for smoother normal
            const dx = p2.x - p0.x;
            const dy = p2.y - p0.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = -dy / len;
            const ny = dx / len;

            this.innerLoop.push({ x: p1.x - nx * halfWidth, y: p1.y - ny * halfWidth });
            this.outerLoop.push({ x: p1.x + nx * halfWidth, y: p1.y + ny * halfWidth });
        }

        // Rebuild Physics
        this.clearPhysics();
        if (this.innerLoop.length < 3) return;

        const bodyDesc = RAPIER.RigidBodyDesc.fixed();
        const wallBody = this.world.createRigidBody(bodyDesc);
        this.walls.push(wallBody);

        const innerFlat: number[] = [];
        this.innerLoop.forEach(p => innerFlat.push(p.x, p.y));
        innerFlat.push(this.innerLoop[0].x, this.innerLoop[0].y); // Close

        const outerFlat: number[] = [];
        this.outerLoop.forEach(p => outerFlat.push(p.x, p.y));
        outerFlat.push(this.outerLoop[0].x, this.outerLoop[0].y); // Close

        const innerCollider = RAPIER.ColliderDesc.polyline(new Float32Array(innerFlat));
        const outerCollider = RAPIER.ColliderDesc.polyline(new Float32Array(outerFlat));

        this.world.createCollider(innerCollider, wallBody);
        this.world.createCollider(outerCollider, wallBody);
    }

    generateSpline(points: { x: number, y: number }[]): { x: number, y: number }[] {
        if (points.length < 3) return points;

        const splinePoints: { x: number, y: number }[] = [];
        const resolution = 10; // segments per control point

        for (let i = 0; i < points.length; i++) {
            const p0 = points[(i - 1 + points.length) % points.length];
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const p3 = points[(i + 2) % points.length];

            for (let t = 0; t < 1; t += 1 / resolution) {
                const tt = t * t;
                const ttt = tt * t;

                // Catmull-Rom
                const q1 = -ttt + 2 * tt - t;
                const q2 = 3 * ttt - 5 * tt + 2;
                const q3 = -3 * ttt + 4 * tt + t;
                const q4 = ttt - tt;

                const tx = 0.5 * (p0.x * q1 + p1.x * q2 + p2.x * q3 + p3.x * q4);
                const ty = 0.5 * (p0.y * q1 + p1.y * q2 + p2.y * q3 + p3.y * q4);

                splinePoints.push({ x: tx, y: ty });
            }
        }

        return splinePoints;
    }

    isPointOnTrack(x: number, y: number): boolean {
        const path = this.path;
        if (path.length < 2) return false;

        let minSqDist = Number.MAX_VALUE;
        // Optimization: Check bounding box of segment first? No, path is fine.
        // Or Grid?
        // For now iteration is fine for 200-300 points.

        const halfWidth = this.trackWidth / 2;
        const limitSq = halfWidth * halfWidth;

        for (let i = 0; i < path.length; i++) {
            const p1 = path[i];
            const p2 = path[(i + 1) % path.length];

            const l2 = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
            if (l2 === 0) continue;

            let t = ((x - p1.x) * (p2.x - p1.x) + (y - p1.y) * (p2.y - p1.y)) / l2;
            t = Math.max(0, Math.min(1, t));

            const px = p1.x + t * (p2.x - p1.x);
            const py = p1.y + t * (p2.y - p1.y);

            const distSq = (x - px) ** 2 + (y - py) ** 2;
            if (distSq < minSqDist) {
                minSqDist = distSq;
            }

            // Early exit?
            if (minSqDist <= limitSq) return true;
        }

        return minSqDist <= limitSq;
    }
}
