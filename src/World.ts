import RAPIER from '@dimforge/rapier2d-compat';
import { Vehicle } from './Vehicle';
import { Input } from './Input';
import { Track } from './Track';

export class World {
    rapierWorld: RAPIER.World;
    vehicles: Vehicle[] = [];
    bestVehicle: Vehicle | null = null;
    track!: Track;
    width = 400; // Increased world size for track
    height = 400;
    eventQueue: RAPIER.EventQueue;
    camera = { x: 0, y: 0, zoom: 10 };

    vehicleCount = 50;
    simulationRunning = true;

    constructor(gravity = { x: 0, y: 0 }) {
        this.rapierWorld = new RAPIER.World(gravity);
        this.eventQueue = new RAPIER.EventQueue(true);
    }

    init() {
        this.track = new Track(this.rapierWorld);

        // Create 50 vehicles with random brains
        for (let i = 0; i < this.vehicleCount; i++) {
            const vehicle = new Vehicle(this.rapierWorld, this.track.startPos.x, this.track.startPos.y);
            this.vehicles.push(vehicle);
        }

        this.bestVehicle = this.vehicles[0];
        this.camera.x = this.track.startPos.x;
        this.camera.y = this.track.startPos.y;
    }

    update(input: Input) {
        if (!this.simulationRunning) return;

        // Handle Track Editing vs Play Mode
        if (this.track && this.track.isEditing) {
            // Camera Control (Arrow Keys)
            const panSpeed = 2; // World units per frame
            if (input.isDown('ArrowUp')) this.camera.y -= panSpeed;
            if (input.isDown('ArrowDown')) this.camera.y += panSpeed;
            if (input.isDown('ArrowLeft')) this.camera.x -= panSpeed;
            if (input.isDown('ArrowRight')) this.camera.x += panSpeed;

            // Mouse to World Conversion using Camera
            // WorldX = (ScreenX - HalfWidth) / Zoom + CameraX
            const worldMouseX = (input.mouseX - window.innerWidth / 2) / this.camera.zoom + this.camera.x;
            const worldMouseY = (input.mouseY - window.innerHeight / 2) / this.camera.zoom + this.camera.y;

            this.track.update(input, { x: worldMouseX, y: worldMouseY });
        } else {
            // Play Mode: Update all vehicles
            // Collect all vehicle colliders to exclude from sensors
            const vehicleColliders = this.vehicles.map(v => v.collider);

            for (const vehicle of this.vehicles) {
                if (!vehicle.isAlive) continue;

                vehicle.update(input, vehicleColliders);

                // Check if vehicle is off track (collision detection)
                // This is now handled by Rapier's collision events, so this check is removed.
                // const pos = vehicle.body.translation();
                // if (this.track && !this.track.isPointOnTrack(pos.x, pos.y)) {
                //     vehicle.isAlive = false;
                // }
            }

            // Find best vehicle (highest fitness among alive vehicles)
            let bestFitness = -1;
            for (const vehicle of this.vehicles) {
                if (vehicle.isAlive && vehicle.distanceTraveled > bestFitness) {
                    bestFitness = vehicle.distanceTraveled;
                    this.bestVehicle = vehicle;
                }
            }

            // Camera follows best vehicle
            if (this.bestVehicle && this.bestVehicle.isAlive) {
                const vPos = this.bestVehicle.body.translation();
                this.camera.x = vPos.x;
                this.camera.y = vPos.y;
            }

            // Check if all vehicles are dead
            const aliveCount = this.vehicles.filter(v => v.isAlive).length;
            if (aliveCount === 0) {
                this.simulationRunning = false;
                console.log('Simulation complete! All vehicles dead.');
            }
        }

        this.rapierWorld.step(this.eventQueue);

        // Process collision events to detect wall hits
        this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
            if (!started) return; // Only care about collision start

            // Check if this collision involves a vehicle and a wall
            for (const vehicle of this.vehicles) {
                if (!vehicle.isAlive) continue;

                const vehicleHandle = vehicle.collider.handle;

                // Check if vehicle is involved in this collision
                if (handle1 === vehicleHandle || handle2 === vehicleHandle) {
                    // Vehicle collided with something
                    // Since vehicles don't collide with each other (due to collision groups),
                    // this must be a wall collision
                    console.log(`Vehicle #${vehicle.id} died! Collision with wall.`);
                    vehicle.isAlive = false;
                    break;
                }
            }
        });
    }

    resetVehicle() {
        // Not used in this simulation mode
    }

}
