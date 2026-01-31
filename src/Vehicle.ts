import RAPIER from '@dimforge/rapier2d-compat';
import { Input } from './Input';
import { Brain } from './Brain';
import { COLLISION_GROUPS, NEURAL_NETWORK, PHYSICS_CONFIG } from './constants';

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
    useBrain: boolean = true; // Enable brain control by default

    world: RAPIER.World;

    // Fitness tracking
    distanceTraveled: number = 0;
    lastPosition: { x: number, y: number } = { x: 0, y: 0 };
    isAlive: boolean = true;
    id: number;

    // Enhanced fitness tracking
    trackProgress: number = 0;
    centerDeviation: number = 0;
    timeAlive: number = 0;
    smoothness: number = 0;
    lapsCompleted: number = 0;
    previousAngularVelocity: number = 0;

    constructor(world: RAPIER.World, x: number, y: number, brain?: Brain, id?: number) {
        this.id = id ?? Math.floor(Math.random() * 1000000);
        this.lastPosition = { x, y };

        // Use provided brain or create new random one
        if (brain) {
            this.brain = brain;
        } else {
            this.brain = new Brain(
                NEURAL_NETWORK.INPUT_COUNT,
                NEURAL_NETWORK.HIDDEN_LAYERS,
                NEURAL_NETWORK.OUTPUT_COUNT
            );
        }

        this.world = world;
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(x, y)
            .setLinearDamping(PHYSICS_CONFIG.LINEAR_DAMPING)
            .setAngularDamping(PHYSICS_CONFIG.ANGULAR_DAMPING);

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

        // Set collision groups: vehicles (group bit 1) collide with walls (group bit 0) but not each other
        colliderDesc.setCollisionGroups(COLLISION_GROUPS.VEHICLES);

        // Enable collision events so we can detect wall hits
        colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

        this.collider = world.createCollider(colliderDesc, this.body);
    }

    update(input: Input, excludeColliders?: RAPIER.Collider[]) {
        if (!this.isAlive) return;

        // Track distance traveled
        const pos = this.body.translation();
        const dx = pos.x - this.lastPosition.x;
        const dy = pos.y - this.lastPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        this.distanceTraveled += distance;
        this.lastPosition = { x: pos.x, y: pos.y };

        // Controls: ArrowUp (Accelerate), ArrowDown (Brake/Reverse), ArrowLeft/Right (Steer)
        const rotation = this.body.rotation();

        // Direction vector (assuming 0 angle is +X)
        const dirX = Math.cos(rotation);
        const dirY = Math.sin(rotation);

        this.updateSensors(excludeColliders);

        // Get brain inputs: sensors + velocity + angular velocity
        const inputs = this.getBrainInputs();
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

    // Get brain inputs: sensors + velocity information
    getBrainInputs(): number[] {
        // Sensor inputs (9)
        const sensorInputs = this.sensors.map(s => {
            if (s.hit) {
                // Normalize and square for better discrimination
                const normalized = 1 - (s.hit.distance / this.sensorLength);
                return normalized;
            }
            return 0;
        });

        // Get vehicle velocity
        const vel = this.body.linvel();
        const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2);
        const normalizedSpeed = Math.min(speed / this.maxSpeed, 1.0);

        // Angular velocity (normalized)
        const angVel = this.body.angvel();
        const normalizedAngVel = Math.tanh(angVel / 5); // Normalize to -1 to 1

        // Total: 11 inputs (9 sensors + speed + angular velocity)
        return [...sensorInputs, normalizedSpeed, normalizedAngVel];
    }

    updateSensors(excludeColliders?: RAPIER.Collider[]) {
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

            const ray = new RAPIER.Ray({ x: startX, y: startY }, { x: dx, y: dy });
            const maxToi = this.sensorLength;
            const solid = true;

            // Find closest hit that isn't a vehicle
            let minToi = maxToi;
            let foundHit = false;

            this.world.intersectionsWithRay(ray, maxToi, solid, (intersection) => {
                const collider = intersection.collider;

                // Skip self collider
                if (collider.handle === this.collider.handle) {
                    return true; // Continue
                }

                // Skip other vehicle colliders if provided
                if (excludeColliders) {
                    let shouldSkip = false;
                    for (const excludeCollider of excludeColliders) {
                        if (collider.handle === excludeCollider.handle) {
                            shouldSkip = true;
                            break;
                        }
                    }
                    if (shouldSkip) {
                        return true; // Continue
                    }
                }

                // This is a wall hit
                const toi = intersection.toi;
                if (toi < minToi) {
                    minToi = toi;
                    foundHit = true;
                }

                return true; // Continue checking other colliders
            });

            if (foundHit) {
                endX = startX + dx * minToi;
                endY = startY + dy * minToi;
                hitData = {
                    x: endX,
                    y: endY,
                    distance: minToi
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
