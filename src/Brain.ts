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
}
