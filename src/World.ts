import RAPIER from '@dimforge/rapier2d-compat';
import { Vehicle } from './Vehicle';
import { Input } from './Input';

export class World {
    rapierWorld: RAPIER.World;
    vehicle: Vehicle;

    constructor(gravity = { x: 0, y: 0 }) {
        this.rapierWorld = new RAPIER.World(gravity);
        this.vehicle = new Vehicle(this.rapierWorld, 0, 0);
    }

    width = 100; // World width in meters
    height = 100; // World height in meters

    update(input: Input) {
        this.vehicle.update(input);
        this.rapierWorld.step();
        this.wrap();
    }

    wrap() {
        const pos = this.vehicle.body.translation();
        let newX = pos.x;
        let newY = pos.y;

        const halfW = this.width / 2;
        const halfH = this.height / 2;

        let wrapped = false;

        if (pos.x > halfW) { newX = -halfW; wrapped = true; }
        else if (pos.x < -halfW) { newX = halfW; wrapped = true; }

        if (pos.y > halfH) { newY = -halfH; wrapped = true; }
        else if (pos.y < -halfH) { newY = halfH; wrapped = true; }

        if (wrapped) {
            this.vehicle.body.setTranslation({ x: newX, y: newY }, true);
        }
    }
}
