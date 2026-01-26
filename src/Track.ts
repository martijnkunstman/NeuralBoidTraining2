import RAPIER from '@dimforge/rapier2d-compat';
import seedrandom from 'seedrandom';

export class Track {
    world: RAPIER.World;
    rng: seedrandom.PRNG;
    walls: RAPIER.RigidBody[] = [];
    gridSize = 10;
    trackWidth = 30; // Uniform width matches renderer
    width: number;
    height: number;
    path: { x: number, y: number }[] = [];
    startPos: { x: number, y: number } = { x: 0, y: 0 };
    innerLoop: { x: number, y: number }[] = [];
    outerLoop: { x: number, y: number }[] = [];

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

    isPointOnTrack(x: number, y: number): boolean {
        // Find distance to nearest segment
        const path = this.path;
        if (path.length < 2) return false;

        let minSqDist = Number.MAX_VALUE;

        for (let i = 0; i < path.length; i++) {
            const p1 = path[i];
            const p2 = path[(i + 1) % path.length];

            // Segment p1-p2
            const l2 = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
            if (l2 === 0) continue;

            // Project point onto line: px = p1 + t * (p2 - p1)
            let t = ((x - p1.x) * (p2.x - p1.x) + (y - p1.y) * (p2.y - p1.y)) / l2;
            t = Math.max(0, Math.min(1, t));

            const px = p1.x + t * (p2.x - p1.x);
            const py = p1.y + t * (p2.y - p1.y);

            const distSq = (x - px) ** 2 + (y - py) ** 2;
            if (distSq < minSqDist) {
                minSqDist = distSq;
            }
        }

        // Check if distance is within half-width
        const halfWidth = this.trackWidth / 2;
        return minSqDist <= (halfWidth * halfWidth);
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

            const displacement = (this.rng() - 0.5) * len * 0.7;

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

        // Generate Walls
        // Create Inner and Outer loops based on normal expansion
        const halfWidth = (this.trackWidth / 2) + 1; // +1 to align with visual border

        for (let i = 0; i < this.path.length; i++) {
            const p0 = this.path[(i - 1 + this.path.length) % this.path.length];
            const p1 = this.path[i];
            const p2 = this.path[(i + 1) % this.path.length];

            // Average Normal
            // Vector p0->p1
            const dx1 = p1.x - p0.x;
            const dy1 = p1.y - p0.y;
            const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
            const n1x = -dy1 / len1;
            const n1y = dx1 / len1;

            // Vector p1->p2
            const dx2 = p2.x - p1.x;
            const dy2 = p2.y - p1.y;
            const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            const n2x = -dy2 / len2;
            const n2y = dx2 / len2;

            // Average
            let nx = (n1x + n2x) / 2;
            let ny = (n1y + n2y) / 2;
            const lenN = Math.sqrt(nx * nx + ny * ny);
            nx /= lenN;
            ny /= lenN;

            // Inward Point (Negative Normal? Depends on winding order. Hull is typically CCW?)
            // If CCW, normal points INWARD. 
            // Wait, hull step: points sort by X, monotone chain... result is usually CCW?
            // cross product check: (b.x - a.x)*(c.y - a.y) ...

            // Let's just create points and we can swap if needed later, or rely on visual border logic.
            // Actually, Renderer uses separate Fill and Stroke but the path is center.
            // Renderer draws path, then strokes with lineWidth.
            // So we just need offsets.

            this.innerLoop.push({ x: p1.x - nx * halfWidth, y: p1.y - ny * halfWidth });
            this.outerLoop.push({ x: p1.x + nx * halfWidth, y: p1.y + ny * halfWidth });
        }

        // Create RigidBodies
        // We use a single Static body and attach colliders, or one body per wall?
        // One static body for all track walls is fine.
        const bodyDesc = RAPIER.RigidBodyDesc.fixed();
        const wallBody = this.world.createRigidBody(bodyDesc);
        this.walls.push(wallBody);

        // Rapier Polyline expects Float32Array of x,y,x,y...
        // We do not need the intermediate Float32Arrays if we use the spread syntax below directly.

        // Indices? No, Polyline just follows points?
        // Wait, 'polyline' collider takes vertices and indices usually?
        // Rapier JS `ColliderDesc.polyline(vertices: Float32Array)`
        // NOTE: Does it automatically close the loop? Probably not.
        // We need to duplicate first point at end? Or indices?

        // Let's consult knowledge or assume explicit closure needed.
        // Actually simpler: Use multiple segments (Segment Collider) OR Trimesh?
        // Polyline is good for walls.

        // Let's verify Rapier API for JS. `ColliderDesc.polyline(vertices)` exists.

        // Duplicate start point to close loop
        const innerFlat: number[] = [];
        this.innerLoop.forEach(p => innerFlat.push(p.x, p.y));
        innerFlat.push(this.innerLoop[0].x, this.innerLoop[0].y); // Close

        const outerFlat: number[] = [];
        this.outerLoop.forEach(p => outerFlat.push(p.x, p.y));
        outerFlat.push(this.outerLoop[0].x, this.outerLoop[0].y); // Close

        const innerClosed = new Float32Array(innerFlat);
        const outerClosed = new Float32Array(outerFlat);

        const innerCollider = RAPIER.ColliderDesc.polyline(innerClosed);
        const outerCollider = RAPIER.ColliderDesc.polyline(outerClosed);

        this.world.createCollider(innerCollider, wallBody);
        this.world.createCollider(outerCollider, wallBody);
    }
}
