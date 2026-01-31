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
    camera = { x: 0, y: 0, zoom: 10 };

    constructor(gravity = { x: 0, y: 0 }) {
        this.rapierWorld = new RAPIER.World(gravity);
        this.eventQueue = new RAPIER.EventQueue(true);
    }

    init() {
        this.track = new Track(this.rapierWorld);
        this.vehicle = new Vehicle(this.rapierWorld, this.track.startPos.x, this.track.startPos.y);
        this.camera.x = this.track.startPos.x;
        this.camera.y = this.track.startPos.y;
    }

    update(input: Input) {
        if (!this.vehicle) return;

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
            // Play Mode: Camera follows vehicle
            const vPos = this.vehicle.body.translation();
            this.camera.x = vPos.x;
            this.camera.y = vPos.y;

            this.vehicle.update(input);
        }

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

}
