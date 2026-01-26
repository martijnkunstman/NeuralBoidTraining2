import RAPIER from '@dimforge/rapier2d-compat';
import { Vehicle } from './Vehicle';
import { Input } from './Input';
import { Track } from './Track';

export class World {
    rapierWorld: RAPIER.World;
    vehicle!: Vehicle;
    track!: Track;
    width = 400; // Increased world size for track
    height = 400;
    eventQueue: RAPIER.EventQueue;

    constructor(gravity = { x: 0, y: 0 }) {
        this.rapierWorld = new RAPIER.World(gravity);
        this.eventQueue = new RAPIER.EventQueue(true);
    }

    init() {
        this.track = new Track(this.rapierWorld, this.width, this.height);
        this.vehicle = new Vehicle(this.rapierWorld, this.track.startPos.x, this.track.startPos.y);
    }

    update(input: Input) {
        if (!this.vehicle) return;
        this.vehicle.update(input);
        this.rapierWorld.step(this.eventQueue);

        // Smart Collision: Distance Check
        const pos = this.vehicle.body.translation();
        if (this.track && !this.track.isPointOnTrack(pos.x, pos.y)) {
            // Off track!
            this.resetVehicle();
        }
    }

    resetVehicle() {
        this.vehicle.body.setTranslation(this.track.startPos, true);
        this.vehicle.body.setLinvel({ x: 0, y: 0 }, true);
        this.vehicle.body.setAngvel(0, true);
        this.vehicle.body.setRotation(0, true);
    }

    regenerateTrack(seed: string) {
        if (this.track) {
            this.track.destroy();
        }
        this.track = new Track(this.rapierWorld, this.width, this.height, seed);
        this.resetVehicle();
    }
}
