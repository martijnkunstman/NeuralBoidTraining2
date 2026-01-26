import RAPIER from '@dimforge/rapier2d-compat';
import { Input } from './Input';

export class Vehicle {
    body: RAPIER.RigidBody;
    collider: RAPIER.Collider;

    // Configuration
    maxSpeed = 30;
    maxForce = 150;
    maxTorque = 150;

    // Dimensions
    width = 2; // Base width
    length = 3; // Height/Length

    // Sensors
    sensorCount = 7;
    sensorLength = 50;
    sensorFov = Math.PI / 2; // 90 degrees
    sensors: { start: { x: number, y: number }, end: { x: number, y: number } }[] = [];

    constructor(world: RAPIER.World, x: number, y: number) {
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(x, y)
            .setLinearDamping(2.0) // Lower drag for gliding
            .setAngularDamping(5.0); // Lower angular damping for momentum in turns

        this.body = world.createRigidBody(bodyDesc);

        // Create a triangle shape
        // Points are relative to center of mass (0,0)
        // Front points to positive Y? Or X? Let's assume Front is +Y (Up) or +X (Right).
        // Usually +X is 0 angle. Let's point to +X.
        // Triangle: (Length/2, 0), (-Length/2, Width/2), (-Length/2, -Width/2)
        const colliderDesc = RAPIER.ColliderDesc.triangle(
            { x: this.length / 2, y: 0 },
            { x: -this.length / 2, y: this.width / 2 },
            { x: -this.length / 2, y: -this.width / 2 }
        );

        this.collider = world.createCollider(colliderDesc, this.body);
    }

    update(input: Input) {
        // Controls: ArrowUp (Accelerate), ArrowDown (Brake/Reverse), ArrowLeft/Right (Steer)
        const rotation = this.body.rotation();

        // Direction vector (assuming 0 angle is +X)
        const dirX = Math.cos(rotation);
        const dirY = Math.sin(rotation);

        if (input.isDown('ArrowUp')) {
            this.body.applyImpulse({ x: dirX * this.maxForce * 0.016, y: dirY * this.maxForce * 0.016 }, true);
        }
        if (input.isDown('ArrowDown')) {
            this.body.applyImpulse({ x: -dirX * this.maxForce * 0.016 * 0.5, y: -dirY * this.maxForce * 0.016 * 0.5 }, true);
        }

        if (input.isDown('ArrowLeft')) {
            this.body.applyTorqueImpulse(-this.maxTorque * 0.016, true);
        }
        if (input.isDown('ArrowRight')) {
            this.body.applyTorqueImpulse(this.maxTorque * 0.016, true);
        }

        this.updateSensors();
    }

    updateSensors() {
        this.sensors = [];
        const { translation, rotation } = this.getTransform();

        // Start rays from center of vehicle
        // Or maybe front? Let's do center for now as per plan, but front might make more sense for "eyes".
        // Plan said: "Calculates the start (vehicle center or front)..."
        // Let's use the actual position (center of mass) as start for now.

        const startX = translation.x;
        const startY = translation.y;

        // Angle logic
        // If count is 1, shoot straight ahead
        // If count > 1, spread across FOV centered on heading

        const heading = rotation;

        for (let i = 0; i < this.sensorCount; i++) {
            let angle = heading;

            if (this.sensorCount > 1) {
                // Map i from 0..count-1 to -fov/2 .. +fov/2
                const ratio = i / (this.sensorCount - 1);
                angle = heading - (this.sensorFov / 2) + (this.sensorFov * ratio);
            }

            const endX = startX + Math.cos(angle) * this.sensorLength;
            const endY = startY + Math.sin(angle) * this.sensorLength;

            this.sensors.push({
                start: { x: startX, y: startY },
                end: { x: endX, y: endY }
            });
        }
    }

    getTransform() {
        return {
            translation: this.body.translation(),
            rotation: this.body.rotation()
        };
    }

    getVelocity() {
        return this.body.linvel();
    }
}
