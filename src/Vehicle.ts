import RAPIER from '@dimforge/rapier2d-compat';
import { Input } from './Input';
import { Brain } from './Brain';

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
    sensorCount = 9;
    sensorLength = 50;
    sensorFov = Math.PI * 0.7; // ~126 degrees (Wider than 90)
    sensors: {
        start: { x: number, y: number },
        end: { x: number, y: number },
        hit?: { x: number, y: number, distance: number }
    }[] = [];

    brain: Brain;
    useBrain: boolean = false;

    world: RAPIER.World;

    constructor(world: RAPIER.World, x: number, y: number) {
        this.brain = new Brain(this.sensorCount, [12, 6], 3); // 9 inputs, 12 hidden, 6 hidden, 3 outputs

        this.world = world;
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


        if (input.isDown('ArrowLeft')) {
            this.body.applyTorqueImpulse(-this.maxTorque * 0.016, true);
        }
        if (input.isDown('ArrowRight')) {
            this.body.applyTorqueImpulse(this.maxTorque * 0.016, true);
        }

        this.updateSensors();
        const inputs = this.sensors.map(s => {
            if (s.hit) {
                return 1 - (s.hit.distance / this.sensorLength);
            } else {
                return 0;
            }
        });

        const outputs = Brain.feedForward(inputs, this.brain);

        if (this.useBrain) {
            // outputs[0] = Left
            // outputs[1] = Right
            // outputs[2] = Forward

            const left = outputs[0];
            const right = outputs[1];
            const forward = outputs[2];

            if (forward > 0.5) { // Threshold or just proportional? Let's use proportional for smooth control
                this.body.applyImpulse({ x: dirX * this.maxForce * 0.016 * forward, y: dirY * this.maxForce * 0.016 * forward }, true);
            }

            const turn = right - left;
            this.body.applyTorqueImpulse(turn * this.maxTorque * 0.016, true);

        } else {
            if (input.isDown('ArrowUp')) {
                this.body.applyImpulse({ x: dirX * this.maxForce * 0.016, y: dirY * this.maxForce * 0.016 }, true);
            }

            if (input.isDown('ArrowLeft')) {
                this.body.applyTorqueImpulse(-this.maxTorque * 0.016, true);
            }
            if (input.isDown('ArrowRight')) {
                this.body.applyTorqueImpulse(this.maxTorque * 0.016, true);
            }
        }
    }

    updateSensors() {
        this.sensors = [];
        const { translation, rotation } = this.getTransform();

        const startX = translation.x;
        const startY = translation.y;
        const heading = rotation;

        for (let i = 0; i < this.sensorCount; i++) {
            let angle = heading;

            if (this.sensorCount > 1) {
                const ratio = i / (this.sensorCount - 1);
                angle = heading - (this.sensorFov / 2) + (this.sensorFov * ratio);
            }

            const dx = Math.cos(angle);
            const dy = Math.sin(angle);

            // Default end point (max range)
            let endX = startX + dx * this.sensorLength;
            let endY = startY + dy * this.sensorLength;
            let hitData = undefined;

            // Raycast
            // Exclude self (optional but good practice, though ray starts inside? Rapier rays don't hit start point usually unless solid?)
            // We can just cast. If we hit our own collider immediately, we might need a filter.
            // But we created a triangle collider. Ray starts at center (0,0 relative).
            // Let's rely on filter or starting slightly outside?
            // Starting at center is risky if we hit ourselves.
            // Rapier default filter includes everything.

            const ray = new RAPIER.Ray({ x: startX, y: startY }, { x: dx, y: dy });
            const maxToi = this.sensorLength;
            const solid = true;

            // Filter: exclude this vehicle's collider
            // QueryFilter: (groups, excludeCollider, excludeBody)
            // We can exclude our own collider.

            const hit = this.world.castRay(ray, maxToi, solid, undefined, undefined, this.collider, this.body);

            if (hit) {
                const toi = hit.toi; // Time of impact (distance)
                endX = startX + dx * toi;
                endY = startY + dy * toi;
                hitData = {
                    x: endX,
                    y: endY,
                    distance: toi
                };
            }

            this.sensors.push({
                start: { x: startX, y: startY },
                end: { x: endX, y: endY },
                hit: hitData
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
