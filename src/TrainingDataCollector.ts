import { TrainingDataPoint, TrainingDataConfig } from './SupervisedTypes';
import { Vehicle } from './Vehicle';

/**
 * Collects training data from vehicles using autosteer
 * Records (sensor inputs → control outputs) pairs for supervised learning
 */
export class TrainingDataCollector {
    private data: TrainingDataPoint[] = [];
    private config: TrainingDataConfig;
    private frameCounter: number = 0;

    constructor(config?: Partial<TrainingDataConfig>) {
        this.config = {
            maxSamples: config?.maxSamples ?? 10000,
            samplingRate: config?.samplingRate ?? 1,  // Sample every frame
            minSpeed: config?.minSpeed ?? 0.5          // Minimum speed to record
        };
    }

    /**
     * Record a training sample from a vehicle
     * @param inputs Neural network inputs (sensors + velocity)
     * @param outputs Autosteer control outputs [left, right, forward]
     * @param vehicle Optional vehicle reference for metadata
     */
    record(inputs: number[], outputs: number[], vehicle?: Vehicle): void {
        this.frameCounter++;

        // Skip if not sampling this frame
        if (this.frameCounter % this.config.samplingRate !== 0) {
            return;
        }

        // Skip if at max capacity
        if (this.data.length >= this.config.maxSamples) {
            return;
        }

        // Skip if vehicle is too slow (likely stuck or spinning)
        if (vehicle) {
            const vel = vehicle.body.linvel();
            const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2);
            if (speed < this.config.minSpeed) {
                return;
            }
        }

        // Record the data point
        this.data.push({
            inputs: [...inputs],       // Copy array
            outputs: [...outputs],     // Copy array
            vehicleId: vehicle?.id,
            fitness: vehicle?.distanceTraveled
        });
    }

    /**
     * Get all collected data
     */
    getData(): TrainingDataPoint[] {
        return this.data;
    }

    /**
     * Get number of samples collected
     */
    getCount(): number {
        return this.data.length;
    }

    /**
     * Clear all collected data
     */
    clear(): void {
        this.data = [];
        this.frameCounter = 0;
    }

    /**
     * Save data to localStorage
     */
    save(key: string = 'supervisedTrainingData'): void {
        try {
            localStorage.setItem(key, JSON.stringify({
                data: this.data,
                config: this.config,
                timestamp: Date.now()
            }));
            console.log(`💾 Saved ${this.data.length} training samples to localStorage`);
        } catch (e) {
            console.error('Failed to save training data:', e);
        }
    }

    /**
     * Load data from localStorage
     */
    load(key: string = 'supervisedTrainingData'): boolean {
        try {
            const saved = localStorage.getItem(key);
            if (!saved) return false;

            const parsed = JSON.parse(saved);
            this.data = parsed.data || [];
            console.log(`📂 Loaded ${this.data.length} training samples from localStorage`);
            return true;
        } catch (e) {
            console.error('Failed to load training data:', e);
            return false;
        }
    }

    /**
     * Export data as JSON for external analysis
     */
    export(): string {
        return JSON.stringify({
            samples: this.data.length,
            config: this.config,
            data: this.data
        }, null, 2);
    }

    /**
     * Get statistics about collected data
     */
    getStats(): {
        count: number,
        avgInputs: number[],
        avgOutputs: number[],
        inputRanges: { min: number[], max: number[] }
    } {
        if (this.data.length === 0) {
            return {
                count: 0,
                avgInputs: [],
                avgOutputs: [],
                inputRanges: { min: [], max: [] }
            };
        }

        const inputDim = this.data[0].inputs.length;
        const outputDim = this.data[0].outputs.length;

        // Calculate averages
        const avgInputs = new Array(inputDim).fill(0);
        const avgOutputs = new Array(outputDim).fill(0);
        const minInputs = new Array(inputDim).fill(Infinity);
        const maxInputs = new Array(inputDim).fill(-Infinity);

        for (const point of this.data) {
            for (let i = 0; i < inputDim; i++) {
                avgInputs[i] += point.inputs[i];
                minInputs[i] = Math.min(minInputs[i], point.inputs[i]);
                maxInputs[i] = Math.max(maxInputs[i], point.inputs[i]);
            }
            for (let i = 0; i < outputDim; i++) {
                avgOutputs[i] += point.outputs[i];
            }
        }

        for (let i = 0; i < inputDim; i++) {
            avgInputs[i] /= this.data.length;
        }
        for (let i = 0; i < outputDim; i++) {
            avgOutputs[i] /= this.data.length;
        }

        return {
            count: this.data.length,
            avgInputs,
            avgOutputs,
            inputRanges: { min: minInputs, max: maxInputs }
        };
    }
}
