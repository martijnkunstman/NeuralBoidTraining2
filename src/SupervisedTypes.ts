/**
 * Single training data point for supervised learning
 */
export interface TrainingDataPoint {
    inputs: number[];      // Neural network inputs (sensors + velocity)
    outputs: number[];     // Expected outputs from autosteer
    fitness?: number;      // Optional fitness score
    vehicleId?: number;    // Optional vehicle identifier
}

/**
 * Training data collector configuration
 */
export interface TrainingDataConfig {
    maxSamples: number;           // Maximum samples to collect
    samplingRate: number;         // Frames between samples (1 = every frame)
    minSpeed: number;             // Minimum vehicle speed to record
}

/**
 * Supervised trainer configuration
 */
export interface SupervisedTrainerConfig {
    learningRate: number;         // Step size for gradient descent
    epochs: number;               // Number of training iterations
    batchSize: number;            // Samples per batch
    validationSplit: number;      // Fraction of data for validation (0-1)
}

/**
 * Training statistics
 */
export interface TrainingStats {
    epoch: number;
    trainLoss: number;
    validationLoss: number;
    duration: number;
}
