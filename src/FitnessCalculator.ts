import { Vehicle } from './Vehicle';
import { Track } from './Track';
import { FITNESS_WEIGHTS } from './constants';

export class FitnessCalculator {
    /**
     * Calculate comprehensive fitness for a vehicle
     * Considers multiple factors to prevent gaming the system
     */
    static calculate(vehicle: Vehicle, _track: Track): number {
        // 1. Track progress (MOST IMPORTANT) - exponentially reward going further
        // This is the primary driver - vehicles must make progress!
        const progressScore = Math.pow(vehicle.trackProgress, 1.5) * FITNESS_WEIGHTS.trackProgress;

        // 2. HEAVY penalty for stagnation (not making progress)
        // If a vehicle stays in the same spot for more than 3 seconds, heavily penalize
        const stagnationThreshold = 180; // 3 seconds at 60 FPS
        let stagnationPenalty = 0;
        if (vehicle.framesWithoutProgress > stagnationThreshold) {
            // Exponential penalty: the longer they're stuck, the worse the penalty
            const stagnantTime = (vehicle.framesWithoutProgress - stagnationThreshold) / 60;
            stagnationPenalty = Math.pow(stagnantTime, 2) * 500; // Severe penalty
        }

        // 3. Penalize deviation from center
        const avgDeviation = vehicle.centerDeviation / Math.max(1, vehicle.timeAlive);
        const centerScore = Math.max(0, FITNESS_WEIGHTS.centerDeviation - avgDeviation * 2);

        // 4. Reward speed (actual distance traveled)
        const speedScore = vehicle.distanceTraveled / Math.max(1, vehicle.timeAlive) * FITNESS_WEIGHTS.speed;

        // 5. Reward smooth driving
        const smoothScore = vehicle.smoothness * FITNESS_WEIGHTS.smoothness;

        // Survival score is minimal now - we only care about progress
        const survivalScore = Math.min(vehicle.timeAlive * 0.5, 10);

        const totalFitness = progressScore + centerScore + speedScore + smoothScore + survivalScore - stagnationPenalty;

        return Math.max(0, totalFitness);
    }

    /**
     * Find the nearest point on track and calculate progress
     */
    static updateTrackProgress(vehicle: Vehicle, track: Track): void {
        if (track.path.length === 0) return;

        let minDist = Infinity;
        let nearestIndex = 0;

        const pos = vehicle.body.translation();

        // Find nearest point on track
        for (let i = 0; i < track.path.length; i++) {
            const p = track.path[i];
            const dx = pos.x - p.x;
            const dy = pos.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minDist) {
                minDist = dist;
                nearestIndex = i;
            }
        }

        // Handle lap completion
        if (vehicle.trackProgress > track.path.length * 0.9 && nearestIndex < track.path.length * 0.1) {
            vehicle.lapsCompleted++;
        }

        // Update track progress (monotonically increasing)
        const currentProgress = nearestIndex + (vehicle.lapsCompleted * track.path.length);
        const previousProgress = vehicle.trackProgress;
        vehicle.trackProgress = Math.max(vehicle.trackProgress, currentProgress);

        // Detect stagnation: if progress hasn't increased, increment counter
        if (vehicle.trackProgress <= previousProgress + 0.1) {
            vehicle.framesWithoutProgress++;
        } else {
            vehicle.framesWithoutProgress = 0; // Reset if making progress
        }

        // Track center deviation
        vehicle.centerDeviation += minDist;

        // Track time alive
        vehicle.timeAlive += 1 / 60; // Assuming 60 FPS

        // Calculate smoothness (penalize large angular velocity changes)
        const angVel = Math.abs(vehicle.body.angvel());
        const prevAngVel = vehicle.previousAngularVelocity || 0;
        const angVelChange = Math.abs(angVel - prevAngVel);

        // Accumulate inverse of change (smoother = higher score)
        vehicle.smoothness += Math.max(0, 1 - angVelChange);
        vehicle.previousAngularVelocity = angVel;
    }
}
