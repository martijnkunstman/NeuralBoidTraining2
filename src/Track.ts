import RAPIER from '@dimforge/rapier2d-compat';
import seedrandom from 'seedrandom';

export class Track {
    world: RAPIER.World;
    rng: seedrandom.PRNG;
    walls: RAPIER.RigidBody[] = [];
    gridSize = 10;
    width: number;
    height: number;
    path: { x: number, y: number }[] = [];
    startPos: { x: number, y: number } = { x: 0, y: 0 };

    constructor(world: RAPIER.World, width: number, height: number, seed: string = '300') {
        this.world = world;
        this.width = width;
        this.height = height;
        this.rng = seedrandom(seed);
        this.generate();
    }

    destroy() {
        for (const wall of this.walls) {
            this.world.removeRigidBody(wall);
        }
        this.walls = [];
    }

    generate() {
        // 1. Generate Random Points
        const points: { x: number, y: number }[] = [];
        const pointCount = 20;
        const margin = 40;
        const availableWidth = this.width - margin * 2;
        const availableHeight = this.height - margin * 2;

        for (let i = 0; i < pointCount; i++) {
            const x = (this.rng() - 0.5) * availableWidth;
            const y = (this.rng() - 0.5) * availableHeight;
            points.push({ x, y });
        }

        // 2. Compute Convex Hull (Monotone Chain)
        points.sort((a, b) => a.x - b.x || a.y - b.y);

        const cross = (o: { x: number, y: number }, a: { x: number, y: number }, b: { x: number, y: number }) => {
            return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        };

        const lower: { x: number, y: number }[] = [];
        for (const p of points) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
                lower.pop();
            }
            lower.push(p);
        }

        const upper: { x: number, y: number }[] = [];
        for (let i = points.length - 1; i >= 0; i--) {
            const p = points[i];
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
                upper.pop();
            }
            upper.push(p);
        }

        upper.pop();
        lower.pop();
        let hull = lower.concat(upper);

        // 3. Displace Midpoints for Organic Shape
        // Insert points between hull vertices and displace them inwards
        let complexPath: { x: number, y: number }[] = [];
        for (let i = 0; i < hull.length; i++) {
            const p1 = hull[i];
            const p2 = hull[(i + 1) % hull.length];

            complexPath.push(p1);

            // Midpoint
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = -dy / len;
            const ny = dx / len;

            // Displace inward (negative normal usually, depending on winding)
            // Monotone chain produces CCW? Or CW? 
            // Let's just try random displacement.
            const displacement = (this.rng() - 0.5) * len * 1.5;

            complexPath.push({
                x: mx + nx * displacement,
                y: my + ny * displacement
            });
        }

        // 4. Spline Smoothing (Chaikin's)
        let smoothPath = complexPath;
        const iterations = 5;

        for (let k = 0; k < iterations; k++) {
            const nextPath: { x: number, y: number }[] = [];
            for (let i = 0; i < smoothPath.length; i++) {
                const p0 = smoothPath[i];
                const p1 = smoothPath[(i + 1) % smoothPath.length];

                nextPath.push({
                    x: 0.75 * p0.x + 0.25 * p1.x,
                    y: 0.75 * p0.y + 0.25 * p1.y
                });

                nextPath.push({
                    x: 0.25 * p0.x + 0.75 * p1.x,
                    y: 0.25 * p0.y + 0.75 * p1.y
                });
            }
            smoothPath = nextPath;
        }

        this.path = smoothPath;
        this.startPos = this.path[0];

        // No Walls for now
    }
}
