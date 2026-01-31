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

    trackData: Array<{ x: number, y: number }> = [{ "x": 126.4090362548828, "y": -12.519186305999757 }, { "x": 154.8090362548828, "y": 2.8808136940002442 }, { "x": 163.3090362548828, "y": 27.480813694000243 }, { "x": 150.10903625488282, "y": 49.98081369400025 }, { "x": 107.50903511047363, "y": 56.68081359863281 }, { "x": 68.50903625488282, "y": 30.280813694000244 }, { "x": 47.60903625488281, "y": 32.08081369400024 }, { "x": 40.30903625488281, "y": 50.58081369400024 }, { "x": 49.70903625488281, "y": 81.68081369400025 }, { "x": 42.909036254882814, "y": 103.78081369400024 }, { "x": 23.109036254882813, "y": 117.38081369400024 }, { "x": -23.79096374511719, "y": 109.88081369400024 }, { "x": -71.59096488952636, "y": 148.8808135986328 }, { "x": -126.59096488952636, "y": 138.9808135986328 }, { "x": -136.49096488952637, "y": 97.28081359863282 }, { "x": -107.99096374511718, "y": 75.58081369400024 }, { "x": -101.69096488952637, "y": 54.68081359863281 }, { "x": -115.0909637451172, "y": 36.780813694000244 }, { "x": -146.9909637451172, "y": 28.380813694000246 }, { "x": -159.79096374511718, "y": -1.019186305999756 }, { "x": -140.9909637451172, "y": -28.019186305999757 }, { "x": -105.0909637451172, "y": -35.31918630599976 }, { "x": -83.0909637451172, "y": -53.619186305999754 }, { "x": -81.69096374511719, "y": -81.31918630599975 }, { "x": -104.19096374511719, "y": -124.11918630599976 }, { "x": -61.29096374511719, "y": -167.31918630599975 }, { "x": 13.609035110473634, "y": -135.1191864013672 }, { "x": 95.60903625488281, "y": -140.61918630599976 }, { "x": 111.70903625488282, "y": -115.61918630599976 }, { "x": 85.50903625488282, "y": -90.61918630599976 }, { "x": 50.909036254882814, "y": -76.81918630599975 }, { "x": 53.10903625488281, "y": -35.219186305999756 }];

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
        this.controlPoints = this.trackData;
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

        // Set collision groups: walls (group bit 0) collide with vehicles (group bit 1)
        // Format: upper 16 bits = filter (what to collide with), lower 16 bits = membership (what group I'm in)
        // Walls: membership = 0x0001 (bit 0), filter = 0x0002 (bit 1 - only vehicles)
        innerCollider.setCollisionGroups(0x00020001);
        outerCollider.setCollisionGroups(0x00020001);

        // Enable collision events
        innerCollider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        outerCollider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

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
