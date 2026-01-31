export interface Vector2D {
    x: number;
    y: number;
}

export interface Transform {
    translation: Vector2D;
    rotation: number;
}

export interface Sensor {
    start: Vector2D;
    end: Vector2D;
    hit?: {
        x: number;
        y: number;
        distance: number;
    };
}

export interface GAConfig {
    populationSize: number;
    eliteCount: number;
    mutationRate: number;
    generationTime: number;
    minMutationRate: number;
    maxMutationRate: number;
    mutationDecayRate: number;
}

export interface VehicleConfig {
    maxSpeed: number;
    maxForce: number;
    maxTorque: number;
    sensorCount: number;
    sensorLength: number;
    sensorFov: number;
    width: number;
    length: number;
}

export interface FitnessWeights {
    trackProgress: number;
    centerDeviation: number;
    survival: number;
    speed: number;
    smoothness: number;
}
