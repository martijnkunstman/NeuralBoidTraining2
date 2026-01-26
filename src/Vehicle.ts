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
            // Swap: Left Arrow now turns Right (CW / negative torque)? 
            // Or did the user mean "Left key steers Left, Right key steers Right" but it was inverted?
            // "Swap left right steering" usually means the current mapping is wrong.
            // Standard: Left Key -> Turn Left (CCW). Right Key -> Turn Right (CW).
            // Previous code: Left -> Positive Torque (CCW). Right -> Negative (CW).
            // If user wants swap, he probably felt it was inverted.
            // So Left -> Negative (CW). Right -> Positive (CCW).
            this.body.applyTorqueImpulse(-this.maxTorque * 0.016, true);
        }
        if (input.isDown('ArrowRight')) {
            this.body.applyTorqueImpulse(this.maxTorque * 0.016, true);
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
