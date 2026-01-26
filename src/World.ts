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

    update(input: Input) {
        this.vehicle.update(input);
        this.rapierWorld.step();
    }
}
