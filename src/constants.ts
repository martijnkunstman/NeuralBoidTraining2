import { GAConfig, VehicleConfig, FitnessWeights } from './types';

export const PHYSICS_CONFIG = {
    LINEAR_DAMPING: 2.0,
    ANGULAR_DAMPING: 5.0,
    TIME_STEP: 1 / 60
} as const;

export const GA_CONFIG: GAConfig = {
    populationSize: 50,
    eliteCount: 15,
    mutationRate: 0.1,
    generationTime: 60, // Max time in seconds
    minMutationRate: 0.05,
    maxMutationRate: 0.2,
    mutationDecayRate: 0.98
};

export const VEHICLE_CONFIG: VehicleConfig = {
    maxSpeed: 30,
    maxForce: 150,
    maxTorque: 150,
    sensorCount: 9,
    sensorLength: 50,
    sensorFov: Math.PI * 0.7,
    width: 2,
    length: 3
};

export const COLLISION_GROUPS = {
    WALLS: 0x00020001,
    VEHICLES: 0x00010002
} as const;

export const NEURAL_NETWORK = {
    INPUT_COUNT: 11, // 9 sensors + speed + angular velocity
    HIDDEN_LAYERS: [16, 8] as number[],
    OUTPUT_COUNT: 3 // left, right, forward
};

export const FITNESS_WEIGHTS: FitnessWeights = {
    trackProgress: 100,
    centerDeviation: 50,
    survival: 50,
    speed: 10,
    smoothness: 20
};

export const GENERATION_CONFIG = {
    NO_IMPROVEMENT_TIMEOUT: 15, // seconds
    PLATEAU_CHECK_GENERATIONS: 20,
    PLATEAU_IMPROVEMENT_THRESHOLD: 0.05
} as const;

// Random seed for deterministic/reproducible training
export const RANDOM_SEED = {
    enabled: true,
    seed: 42 // Change this number for different deterministic runs
} as const;
