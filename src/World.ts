import RAPIER from '@dimforge/rapier2d-compat';
import { Vehicle } from './Vehicle';
import { Input } from './Input';
import { Track } from './Track';
import { Brain } from './Brain';

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

    // Genetic Algorithm properties
    generation = 1;
    generationTime = 30; // seconds per generation
    generationTimer = 0; // current time in generation
    eliteCount = 10; // number of top performers to keep
    mutationRate = 0.1; // 10% mutation chance

    bestBrainEver: Brain | null = null;
    bestFitnessEver = 0;
    generationHistory: { gen: number, bestFitness: number }[] = [];

    constructor(gravity = { x: 0, y: 0 }) {
        this.rapierWorld = new RAPIER.World(gravity);
        this.eventQueue = new RAPIER.EventQueue(true);
    }

    init() {
        this.track = new Track(this.rapierWorld);

        // Try to load best brain from localStorage
        const savedBrain = localStorage.getItem('bestBrain');
        if (savedBrain) {
            try {
                const brainData = JSON.parse(savedBrain);
                this.bestBrainEver = this.deserializeBrain(brainData);
                console.log('Loaded best brain from localStorage');
            } catch (e) {
                console.error('Failed to load best brain', e);
            }
        }

        this.spawnGeneration();
    }

    spawnGeneration(parentBrains?: Brain[]) {
        // Clear existing vehicles
        for (const vehicle of this.vehicles) {
            this.rapierWorld.removeRigidBody(vehicle.body);
        }
        this.vehicles = [];

        if (!parentBrains || parentBrains.length === 0) {
            // First generation: random brains
            for (let i = 0; i < this.vehicleCount; i++) {
                const vehicle = new Vehicle(this.rapierWorld, this.track.startPos.x, this.track.startPos.y, undefined, i);
                this.vehicles.push(vehicle);
            }
        } else {
            // Create new generation from parents
            for (let i = 0; i < this.vehicleCount; i++) {
                let brain: Brain;

                if (i < this.eliteCount) {
                    // Elite: copy best performers directly
                    brain = parentBrains[i].clone();
                } else {
                    // Breeding: select two random parents and cross them over
                    const parent1 = parentBrains[Math.floor(Math.random() * parentBrains.length)];
                    const parent2 = parentBrains[Math.floor(Math.random() * parentBrains.length)];
                    brain = Brain.crossover(parent1, parent2);

                    // Mutate offspring
                    Brain.mutate(brain, this.mutationRate);
                }

                const vehicle = new Vehicle(this.rapierWorld, this.track.startPos.x, this.track.startPos.y, brain, i);
                this.vehicles.push(vehicle);
            }
        }

        this.bestVehicle = this.vehicles[0];
        this.generationTimer = 0;
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
            const worldMouseX = (input.mouseX - window.innerWidth / 2) / this.camera.zoom + this.camera.x;
            const worldMouseY = (input.mouseY - window.innerHeight / 2) / this.camera.zoom + this.camera.y;

            this.track.update(input, { x: worldMouseX, y: worldMouseY });
        } else {
            // Play Mode: Update all vehicles
            this.generationTimer += 1 / 60; // Assuming 60 FPS

            // Collect all vehicle colliders to exclude from sensors
            const vehicleColliders = this.vehicles.map(v => v.collider);

            for (const vehicle of this.vehicles) {
                if (!vehicle.isAlive) continue;

                vehicle.update(input, vehicleColliders);
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

            // Check if generation time is up or all vehicles dead
            const aliveCount = this.vehicles.filter(v => v.isAlive).length;
            const timeUp = this.generationTimer >= this.generationTime;

            if (aliveCount === 0 || timeUp) {
                this.nextGeneration();
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
                    vehicle.isAlive = false;
                    break;
                }
            }
        });
    }

    nextGeneration() {
        // Sort vehicles by fitness (distance traveled)
        const sorted = [...this.vehicles].sort((a, b) => b.distanceTraveled - a.distanceTraveled);

        const bestFitness = sorted[0].distanceTraveled;

        // Update all-time best
        if (bestFitness > this.bestFitnessEver) {
            this.bestFitnessEver = bestFitness;
            this.bestBrainEver = sorted[0].brain.clone();

            // Save to localStorage
            localStorage.setItem('bestBrain', JSON.stringify(this.serializeBrain(this.bestBrainEver)));
            console.log(`New best brain! Fitness: ${bestFitness.toFixed(2)}`);
        }

        // Record generation stats
        this.generationHistory.push({ gen: this.generation, bestFitness });

        console.log(`Generation ${this.generation} complete! Best: ${bestFitness.toFixed(2)}, All-time: ${this.bestFitnessEver.toFixed(2)}`);

        // Select parent brains for next generation
        const parentBrains = sorted.slice(0, Math.max(this.eliteCount, 10)).map(v => v.brain);

        // Increment generation counter
        this.generation++;

        // Spawn next generation
        this.spawnGeneration(parentBrains);
    }

    serializeBrain(brain: Brain): any {
        return {
            levels: brain.levels.map(level => ({
                weights: level.weights,
                biases: level.biases
            }))
        };
    }

    deserializeBrain(data: any): Brain {
        const brain = new Brain(9, [12, 6], 3); // Match vehicle brain structure

        for (let i = 0; i < brain.levels.length && i < data.levels.length; i++) {
            const levelData = data.levels[i];
            brain.levels[i].weights = levelData.weights;
            brain.levels[i].biases = levelData.biases;
        }

        return brain;
    }

    resetVehicle() {
        // Not used in this simulation mode
    }

}
