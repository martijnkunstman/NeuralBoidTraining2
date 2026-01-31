export class Brain {
    levels: Level[];

    constructor(inputs: number, hiddenLayers: number[], outputs: number) {
        this.levels = [];

        // Input layer to first hidden layer
        let inputCount = inputs;

        for (let i = 0; i < hiddenLayers.length; i++) {
            const hiddenCount = hiddenLayers[i];
            this.levels.push(new Level(inputCount, hiddenCount));
            inputCount = hiddenCount;
        }

        // Last hidden layer to output layer
        this.levels.push(new Level(inputCount, outputs));
    }

    static feedForward(givenInputs: number[], brain: Brain): number[] {
        let outputs = Level.feedForward(givenInputs, brain.levels[0]);
        for (let i = 1; i < brain.levels.length; i++) {
            outputs = Level.feedForward(outputs, brain.levels[i]);
        }
        return outputs;
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

    constructor(inputCount: number, outputCount: number) {
        this.inputs = new Array(inputCount);
        this.outputs = new Array(outputCount);
        this.biases = new Array(outputCount);

        this.weights = [];
        for (let i = 0; i < inputCount; i++) {
            this.weights[i] = new Array(outputCount);
        }

        Level.randomize(this);
    }

    static randomize(level: Level) {
        for (let i = 0; i < level.inputs.length; i++) {
            for (let j = 0; j < level.outputs.length; j++) {
                level.weights[i][j] = Math.random() * 2 - 1; // Range -1 to 1
            }
        }

        for (let i = 0; i < level.biases.length; i++) {
            level.biases[i] = Math.random() * 2 - 1; // Range -1 to 1
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

            // Activation function (Sigmoid)
            level.outputs[i] = 1 / (1 + Math.exp(-sum)); // Returns 0-1
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

    // Mutate level weights and biases
    static mutate(level: Level, mutationRate: number): void {
        // Mutate weights
        for (let i = 0; i < level.weights.length; i++) {
            for (let j = 0; j < level.weights[i].length; j++) {
                if (Math.random() < mutationRate) {
                    // Random mutation: either small adjustment or complete randomization
                    if (Math.random() < 0.5) {
                        // Small adjustment
                        level.weights[i][j] += (Math.random() * 2 - 1) * 0.5;
                        // Clamp to -1 to 1
                        level.weights[i][j] = Math.max(-1, Math.min(1, level.weights[i][j]));
                    } else {
                        // Complete randomization
                        level.weights[i][j] = Math.random() * 2 - 1;
                    }
                }
            }
        }

        // Mutate biases
        for (let i = 0; i < level.biases.length; i++) {
            if (Math.random() < mutationRate) {
                if (Math.random() < 0.5) {
                    level.biases[i] += (Math.random() * 2 - 1) * 0.5;
                    level.biases[i] = Math.max(-1, Math.min(1, level.biases[i]));
                } else {
                    level.biases[i] = Math.random() * 2 - 1;
                }
            }
        }
    }

    // Crossover two levels
    static crossover(parent1: Level, parent2: Level): Level {
        const child = parent1.clone();

        // Crossover weights - randomly pick from either parent
        for (let i = 0; i < child.weights.length; i++) {
            for (let j = 0; j < child.weights[i].length; j++) {
                if (Math.random() < 0.5) {
                    child.weights[i][j] = parent2.weights[i][j];
                }
            }
        }

        // Crossover biases
        for (let i = 0; i < child.biases.length; i++) {
            if (Math.random() < 0.5) {
                child.biases[i] = parent2.biases[i];
            }
        }

        return child;
    }
}
