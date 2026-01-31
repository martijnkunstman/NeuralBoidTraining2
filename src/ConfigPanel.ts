import GUI from 'lil-gui';
import { World } from './World';

export class ConfigPanel {
    gui: GUI;
    world: World;

    constructor(world: World) {
        this.world = world;
        this.gui = new GUI();
        const vehicle = this.world.vehicle;

        const physicsFolder = this.gui.addFolder('Physics');

        physicsFolder.add(vehicle, 'maxSpeed', 0, 100);
        physicsFolder.add(vehicle, 'maxForce', 0, 500);
        physicsFolder.add(vehicle, 'maxTorque', 0, 500);

        // Damping needs special handling as it writes to the Rapier body
        const dampingConfig = {
            linearDamping: vehicle.body.linearDamping(),
            angularDamping: vehicle.body.angularDamping()
        };

        physicsFolder.add(dampingConfig, 'linearDamping', 0, 10).onChange((v: number) => {
            vehicle.body.setLinearDamping(v);
        });

        physicsFolder.add(dampingConfig, 'angularDamping', 0, 50).onChange((v: number) => {
            vehicle.body.setAngularDamping(v);
        });

        const trackFolder = this.gui.addFolder('Track Editor');

        const trackConfig = {
            editMode: false,
            clearTrack: () => {
                const updatedTrack = this.world.track;
                updatedTrack.controlPoints = [];
                updatedTrack.createDefaultTrack();
                updatedTrack.save();
            }
        };

        trackFolder.add(trackConfig, 'editMode').name('Edit Mode').onChange((v: boolean) => {
            this.world.track.isEditing = v;
        });

        trackFolder.add(trackConfig, 'clearTrack').name('Reset / Clear Track');

        trackFolder.add(this.world.track, 'trackWidth', 10, 100).name('Width').onChange(() => {
            this.world.track.rebuildFunction();
        });

        const sensorFolder = this.gui.addFolder('Sensors');
        sensorFolder.add(vehicle, 'sensorCount', 1, 50, 1).name('Count');
        sensorFolder.add(vehicle, 'sensorLength', 10, 300).name('Length');

        // FOV configuration helper
        const sensorConfig = {
            fovDeg: (vehicle.sensorFov * 180) / Math.PI
        };
        sensorFolder.add(sensorConfig, 'fovDeg', 0, 360).name('FOV (Deg)').onChange((v: number) => {
            vehicle.sensorFov = (v * Math.PI) / 180;
        });

        physicsFolder.open();
        trackFolder.open();
        sensorFolder.open();
    }
}
