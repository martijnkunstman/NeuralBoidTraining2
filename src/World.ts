import RAPIER from '@dimforge/rapier2d-compat';
import { Vehicle } from './Vehicle';
import { Input } from './Input';
import { Track } from './Track';
import { Brain } from './Brain';
import { FitnessCalculator } from './FitnessCalculator';
import { GA_CONFIG, GENERATION_CONFIG, NEURAL_NETWORK } from './constants';

export class World {
    rapierWorld: RAPIER.World;
    vehicles: Vehicle[] = [];
    bestVehicle: Vehicle | null = null;
    track!: Track;
    width = 400; // Increased world size for track
    height = 400;
    eventQueue: RAPIER.EventQueue;
    camera = { x: 0, y: 0, zoom: 10 };

    vehicleCount = GA_CONFIG.populationSize;
    simulationRunning = true;

    // Genetic Algorithm properties
    generation = 1;
    generationTime = GA_CONFIG.generationTime; // Max seconds per generation
    generationTimer = 0; // current time in generation
    eliteCount = GA_CONFIG.eliteCount; // number of top performers to keep
    mutationRate = GA_CONFIG.mutationRate; // base mutation rate

    // Dynamic generation ending
    lastBestFitness = 0;
    lastImprovementTime = 0;

    bestBrainEver: Brain | null = null;
    bestFitnessEver = 0;
    generationHistory: { gen: number, bestFitness: number, avgFitness: number, avgTop10: number }[] = [];

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

        // Load generation history from localStorage
        const savedHistory = localStorage.getItem('generationHistory');
        if (savedHistory) {
            try {
                const historyData = JSON.parse(savedHistory);
                if (Array.isArray(historyData) && historyData.length > 0) {
                    this.generationHistory = historyData;

                    // Resume from last generation
                    const lastGen = historyData[historyData.length - 1];
                    this.generation = lastGen.gen + 1;
                    this.bestFitnessEver = Math.max(...historyData.map(h => h.bestFitness));

                    console.log(`📊 Loaded ${historyData.length} generations from localStorage`);
                    console.log(`🔄 Resuming from generation ${this.generation}`);
                }
            } catch (e) {
                console.error('Failed to load generation history', e);
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

                // Update track progress and fitness metrics
                FitnessCalculator.updateTrackProgress(vehicle, this.track);
            }

            // Find best vehicle (highest fitness among alive vehicles)
            let bestFitness = -1;
            for (const vehicle of this.vehicles) {
                if (!vehicle.isAlive) continue;

                const fitness = FitnessCalculator.calculate(vehicle, this.track);
                if (fitness > bestFitness) {
                    bestFitness = fitness;
                    this.bestVehicle = vehicle;
                }
            }

            // Track improvement for dynamic generation ending
            if (bestFitness > this.lastBestFitness) {
                this.lastBestFitness = bestFitness;
                this.lastImprovementTime = this.generationTimer;
            }

            // Camera follows best vehicle
            if (this.bestVehicle && this.bestVehicle.isAlive) {
                const vPos = this.bestVehicle.body.translation();
                this.camera.x = vPos.x;
                this.camera.y = vPos.y;
            }

            // Check if generation should end
            const aliveCount = this.vehicles.filter(v => v.isAlive).length;
            const alivePercentage = aliveCount / this.vehicleCount;
            const timeUp = this.generationTimer >= this.generationTime;
            const noImprovementTime = this.generationTimer - this.lastImprovementTime;
            const stagnant = noImprovementTime > GENERATION_CONFIG.NO_IMPROVEMENT_TIMEOUT;
            const mostDead = alivePercentage <= 0.25; // 75% or more are dead

            if (aliveCount === 0 || timeUp || stagnant || mostDead) {
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
        // Calculate fitness for all vehicles
        const vehiclesWithFitness = this.vehicles.map(vehicle => ({
            vehicle,
            fitness: FitnessCalculator.calculate(vehicle, this.track)
        }));

        // Sort by fitness
        const sorted = vehiclesWithFitness.sort((a, b) => b.fitness - a.fitness);

        const bestFitness = sorted[0].fitness;
        const avgFitness = sorted.reduce((sum, v) => sum + v.fitness, 0) / sorted.length;
        const avgTop10 = sorted.slice(0, 10).reduce((sum, v) => sum + v.fitness, 0) / 10;

        // Update all-time best
        if (bestFitness > this.bestFitnessEver) {
            this.bestFitnessEver = bestFitness;
            this.bestBrainEver = sorted[0].vehicle.brain.clone();

            // Save to localStorage
            localStorage.setItem('bestBrain', JSON.stringify(this.serializeBrain(this.bestBrainEver)));
            console.log(`🏆 New best brain! Fitness: ${bestFitness.toFixed(2)}`);
        }

        // Record generation stats
        this.generationHistory.push({
            gen: this.generation,
            bestFitness,
            avgFitness,
            avgTop10
        });


        // Save history to localStorage every generation for persistent progress tracking
        localStorage.setItem('generationHistory', JSON.stringify(this.generationHistory));

        console.log(`Gen ${this.generation}: Best=${bestFitness.toFixed(1)} Avg=${avgFitness.toFixed(1)} AvgTop10=${avgTop10.toFixed(1)} AllTime=${this.bestFitnessEver.toFixed(1)}`);

        // Adaptive mutation rate
        if (this.detectPlateau()) {
            this.mutationRate = Math.min(GA_CONFIG.maxMutationRate, this.mutationRate * 1.5);
            console.log(`📊 Plateau detected! Increasing mutation to ${(this.mutationRate * 100).toFixed(1)}%`);
        } else {
            this.mutationRate = this.getAdaptiveMutationRate();
        }

        // Select parent brains for next generation
        const parentBrains = sorted.slice(0, Math.max(this.eliteCount, 10)).map(v => v.vehicle.brain);

        // Increment generation counter
        this.generation++;

        // Spawn next generation
        this.spawnGeneration(parentBrains);
    }

    // Get adaptive mutation rate based on generation
    getAdaptiveMutationRate(): number {
        const rate = GA_CONFIG.maxMutationRate * Math.pow(GA_CONFIG.mutationDecayRate, this.generation);
        return Math.max(GA_CONFIG.minMutationRate, rate);
    }

    // Detect if evolution has plateaued
    detectPlateau(): boolean {
        const checkGen = GENERATION_CONFIG.PLATEAU_CHECK_GENERATIONS;
        if (this.generationHistory.length < checkGen * 2) return false;

        const recent = this.generationHistory.slice(-checkGen);
        const older = this.generationHistory.slice(-checkGen * 2, -checkGen);

        const avgRecent = recent.reduce((sum, g) => sum + g.bestFitness, 0) / checkGen;
        const avgOlder = older.reduce((sum, g) => sum + g.bestFitness, 0) / checkGen;

        if (avgOlder === 0) return false;

        const improvement = (avgRecent - avgOlder) / avgOlder;
        return improvement < GENERATION_CONFIG.PLATEAU_IMPROVEMENT_THRESHOLD;
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
        // Validate data
        if (!data || !data.levels || !Array.isArray(data.levels)) {
            console.error('Invalid brain data, using new random brain');
            return new Brain(
                NEURAL_NETWORK.INPUT_COUNT,
                NEURAL_NETWORK.HIDDEN_LAYERS,
                NEURAL_NETWORK.OUTPUT_COUNT
            );
        }

        const brain = new Brain(
            NEURAL_NETWORK.INPUT_COUNT,
            NEURAL_NETWORK.HIDDEN_LAYERS,
            NEURAL_NETWORK.OUTPUT_COUNT
        );

        for (let i = 0; i < brain.levels.length && i < data.levels.length; i++) {
            const levelData = data.levels[i];

            // Validate dimensions match
            if (!levelData.weights || !levelData.biases ||
                levelData.weights.length !== brain.levels[i].weights.length) {
                console.warn('Brain structure mismatch at level', i, '- using random initialization');
                continue;
            }

            brain.levels[i].weights = levelData.weights;
            brain.levels[i].biases = levelData.biases;
        }

        return brain;
    }

    resetVehicle() {
        // Not used in this simulation mode
    }

}
