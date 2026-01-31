import { Vehicle } from './Vehicle';
import { Track } from './Track';
import { FITNESS_WEIGHTS } from './constants';

export class FitnessCalculator {
    /**
     * Calculate comprehensive fitness for a vehicle
     * Considers multiple factors to prevent gaming the system
     */
    static calculate(vehicle: Vehicle, _track: Track): number {
        // 1. Track progress (most important) - how far along the track
        const progressScore = vehicle.trackProgress * FITNESS_WEIGHTS.trackProgress;

        // 2. Penalize deviation from center
        const avgDeviation = vehicle.centerDeviation / Math.max(1, vehicle.timeAlive);
        const centerScore = Math.max(0, FITNESS_WEIGHTS.centerDeviation - avgDeviation * 2);

        // 3. Reward survival time (but cap it to prevent camping)
        const survivalScore = Math.min(vehicle.timeAlive * 2, FITNESS_WEIGHTS.survival);

        // 4. Reward speed (distance / time)
        const speedScore = vehicle.distanceTraveled / Math.max(1, vehicle.timeAlive) * FITNESS_WEIGHTS.speed;

        // 5. Reward smooth driving (penalize erratic behavior)
        const smoothScore = vehicle.smoothness * FITNESS_WEIGHTS.smoothness;

        const totalFitness = progressScore + centerScore + survivalScore + speedScore + smoothScore;

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
        vehicle.trackProgress = Math.max(vehicle.trackProgress, currentProgress);

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
