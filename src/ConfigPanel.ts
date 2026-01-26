import GUI from 'lil-gui';
import { Vehicle } from './Vehicle';

export class ConfigPanel {
    gui: GUI;
    vehicle: Vehicle;

    constructor(vehicle: Vehicle) {
        this.vehicle = vehicle;
        this.gui = new GUI();

        const physicsFolder = this.gui.addFolder('Physics');

        physicsFolder.add(this.vehicle, 'maxSpeed', 0, 100);
        physicsFolder.add(this.vehicle, 'maxForce', 0, 500);
        physicsFolder.add(this.vehicle, 'maxTorque', 0, 500);

        // Damping needs special handling as it writes to the Rapier body
        const dampingConfig = {
            linearDamping: this.vehicle.body.linearDamping(),
            angularDamping: this.vehicle.body.angularDamping()
        };

        physicsFolder.add(dampingConfig, 'linearDamping', 0, 10).onChange((v: number) => {
            this.vehicle.body.setLinearDamping(v);
        });

        physicsFolder.add(dampingConfig, 'angularDamping', 0, 50).onChange((v: number) => {
            this.vehicle.body.setAngularDamping(v);
        });

        physicsFolder.open();
    }
}
