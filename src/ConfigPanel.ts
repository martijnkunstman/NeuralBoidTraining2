import GUI from 'lil-gui';
import { World } from './World';

export class ConfigPanel {
    gui: GUI;
    world: World;

    constructor(world: World) {
        this.world = world;
        this.gui = new GUI();

        // Use first vehicle as reference for configuration
        const vehicle = this.world.vehicles[0];

        // Only create config if we have vehicles
        if (!vehicle) return;

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

        const aiFolder = this.gui.addFolder('AI');
        aiFolder.add(vehicle, 'useBrain').name('Brain Control');

        const gaFolder = this.gui.addFolder('Genetic Algorithm');
        gaFolder.add(this.world, 'generationTime', 10, 120).name('Gen Time (s)');
        gaFolder.add(this.world, 'mutationRate', 0, 1, 0.01).name('Mutation Rate');
        gaFolder.add(this.world, 'eliteCount', 1, 20, 1).name('Elite Count');

        const gaActions = {
            resetTraining: () => {
                // Clear all localStorage data
                localStorage.removeItem('bestBrain');
                localStorage.removeItem('generationHistory');

                // Reset world state
                this.world.bestBrainEver = null;
                this.world.bestFitnessEver = 0;
                this.world.generation = 1;
                this.world.generationHistory = [];

                // Restart with fresh generation
                this.world.spawnGeneration();
                console.log('🔄 Training reset! All localStorage cleared.');
            }
        };
        gaFolder.add(gaActions, 'resetTraining').name('Reset Training');

        physicsFolder.open();
        trackFolder.open();
        sensorFolder.open();
        aiFolder.open();
        gaFolder.open();
    }
}
