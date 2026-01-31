export class Brain {
    levels: Level[];

    constructor(inputs: number, hiddenLayers: number[], outputs: number) {
        // Validation
        if (inputs <= 0 || outputs <= 0) {
            throw new Error('Brain: inputs and outputs must be positive');
        }

        if (hiddenLayers.some(h => h <= 0)) {
            throw new Error('Brain: all hidden layer sizes must be positive');
        }

        this.levels = [];

        // Input layer to first hidden layer
        let inputCount = inputs;

        for (let i = 0; i < hiddenLayers.length; i++) {
            const hiddenCount = hiddenLayers[i];
            this.levels.push(new Level(inputCount, hiddenCount, false));
            inputCount = hiddenCount;
        }

        // Last hidden layer to output layer (use tanh activation)
        this.levels.push(new Level(inputCount, outputs, true));
    }

    static feedForward(givenInputs: number[], brain: Brain): number[] {
        let outputs = Level.feedForward(givenInputs, brain.levels[0]);
        for (let i = 1; i < brain.levels.length; i++) {
            outputs = Level.feedForward(outputs, brain.levels[i]);
        }
        return outputs;
    }

    // Generate Gaussian random number using Box-Muller transform
    static gaussianRandom(): number {
        const u = Math.random();
        const v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    // Clone this brain
    clone(): Brain {
        const cloned = Object.create(Object.getPrototypeOf(this));
        cloned.levels = this.levels.map(level => level.clone());
        return cloned;
    }

    // Mutate brain weights and biases
    static mutate(brain: Brain, mutationRate: number = 0.1): void {
        for (const level of brain.levels) {
            Level.mutate(level, mutationRate);
        }
    }

    // Crossover two brains to create offspring
    static crossover(parent1: Brain, parent2: Brain): Brain {
        const child = parent1.clone();
        for (let i = 0; i < child.levels.length; i++) {
            child.levels[i] = Level.crossover(parent1.levels[i], parent2.levels[i]);
        }
        return child;
    }
}

export class Level {
    inputs: number[];
    outputs: number[];
    biases: number[];
    weights: number[][];
    isOutputLayer: boolean;

    constructor(inputCount: number, outputCount: number, isOutputLayer: boolean = false) {
        this.inputs = new Array(inputCount);
        this.outputs = new Array(outputCount);
        this.biases = new Array(outputCount);
        this.isOutputLayer = isOutputLayer;

        this.weights = [];
        for (let i = 0; i < inputCount; i++) {
            this.weights[i] = new Array(outputCount);
        }

        Level.randomize(this);
    }

    static randomize(level: Level) {
        for (let i = 0; i < level.inputs.length; i++) {
            for (let j = 0; j < level.outputs.length; j++) {
                level.weights[i][j] = Math.random() * 4 - 2; // Range -2 to 2
            }
        }

        for (let i = 0; i < level.biases.length; i++) {
            level.biases[i] = Math.random() * 4 - 2; // Range -2 to 2
        }
    }

    static feedForward(givenInputs: number[], level: Level): number[] {
        for (let i = 0; i < level.inputs.length; i++) {
            level.inputs[i] = givenInputs[i];
        }

        for (let i = 0; i < level.outputs.length; i++) {
            let sum = 0;
            for (let j = 0; j < level.inputs.length; j++) {
                sum += level.inputs[j] * level.weights[j][i];
            }
            // Add bias
            sum += level.biases[i];

            // Use tanh for output layer (range -1 to 1), sigmoid for hidden layers (range 0 to 1)
            if (level.isOutputLayer) {
                level.outputs[i] = Math.tanh(sum); // -1 to 1
            } else {
                level.outputs[i] = 1 / (1 + Math.exp(-sum)); // 0 to 1 (sigmoid)
            }
        }

        return level.outputs;
    }

    // Clone this level
    clone(): Level {
        const cloned = Object.create(Object.getPrototypeOf(this));
        cloned.inputs = [...this.inputs];
        cloned.outputs = [...this.outputs];
        cloned.biases = [...this.biases];
        cloned.weights = this.weights.map(row => [...row]);
        return cloned;
    }

    // Mutate level weights and biases with Gaussian distribution
    static mutate(level: Level, mutationRate: number): void {
        // Mutate weights
        for (let i = 0; i < level.weights.length; i++) {
            for (let j = 0; j < level.weights[i].length; j++) {
                if (Math.random() < mutationRate) {
                    const r = Math.random();
                    if (r < 0.4) {
                        // Small Gaussian nudge (most common)
                        level.weights[i][j] += Brain.gaussianRandom() * 0.3;
                        level.weights[i][j] = Math.max(-2, Math.min(2, level.weights[i][j]));
                    } else if (r < 0.75) {
                        // Medium change
                        level.weights[i][j] += (Math.random() * 2 - 1) * 0.8;
                        level.weights[i][j] = Math.max(-2, Math.min(2, level.weights[i][j]));
                    } else {
                        // Complete randomization
                        level.weights[i][j] = Math.random() * 4 - 2;
                    }
                }
            }
        }

        // Mutate biases
        for (let i = 0; i < level.biases.length; i++) {
            if (Math.random() < mutationRate) {
                const r = Math.random();
                if (r < 0.4) {
                    level.biases[i] += Brain.gaussianRandom() * 0.3;
                    level.biases[i] = Math.max(-2, Math.min(2, level.biases[i]));
                } else if (r < 0.75) {
                    level.biases[i] += (Math.random() * 2 - 1) * 0.8;
                    level.biases[i] = Math.max(-2, Math.min(2, level.biases[i]));
                } else {
                    level.biases[i] = Math.random() * 4 - 2;
                }
            }
        }
    }

    // Crossover two levels using single-point crossover
    static crossover(parent1: Level, parent2: Level): Level {
        const child = parent1.clone();

        // 50% chance to use single-point crossover, 50% uniform
        if (Math.random() < 0.5) {
            // Single-point crossover: preserves structure better
            const crossoverPoint = Math.floor(Math.random() * child.weights.length);

            for (let i = 0; i < child.weights.length; i++) {
                for (let j = 0; j < child.weights[i].length; j++) {
                    if (i >= crossoverPoint) {
                        child.weights[i][j] = parent2.weights[i][j];
                    }
                }
            }

            for (let i = 0; i < child.biases.length; i++) {
                if (i >= crossoverPoint) {
                    child.biases[i] = parent2.biases[i];
                }
            }
        } else {
            // Uniform crossover
            for (let i = 0; i < child.weights.length; i++) {
                for (let j = 0; j < child.weights[i].length; j++) {
                    if (Math.random() < 0.5) {
                        child.weights[i][j] = parent2.weights[i][j];
                    }
                }
            }

            for (let i = 0; i < child.biases.length; i++) {
                if (Math.random() < 0.5) {
                    child.biases[i] = parent2.biases[i];
                }
            }
        }

        return child;
    }
}
