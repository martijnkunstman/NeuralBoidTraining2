import { Vehicle } from './Vehicle';
import { Track } from './Track';

export class FitnessCalculator {
    /**
     * Calculate fitness based primarily on distance traveled along the track
     */
    static calculate(vehicle: Vehicle): number {
        // Primary metric: track progress (distance along track)
        // This is measured in track waypoints completed
        let fitness = vehicle.trackProgress * 100;

        // Small bonus for staying alive longer (prevents immediate crashes)
        fitness += vehicle.timeAlive * 0.5;

        // Small penalty for straying too far from center (keeps vehicles on track)
        fitness -= vehicle.centerDeviation * 0.1;

        // Tiny penalty for stagnation (prevents getting stuck)
        if (vehicle.framesWithoutProgress > 180) { // 3 seconds at 60fps
            fitness -= (vehicle.framesWithoutProgress - 180) * 0.1;
        }

        return Math.max(0, fitness);
    }

    /**
     * Update vehicle's track progress
     */
    static updateTrackProgress(vehicle: Vehicle, track: Track): void {
        if (!vehicle.isAlive || !track || !track.path || track.path.length === 0) {
            return;
        }

        const pos = vehicle.body.translation();

        // Find nearest track point
        let minDist = Infinity;
        let nearestIndex = 0;

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

        // Update track progress (waypoint index represents distance along track)
        const oldProgress = vehicle.trackProgress;
        vehicle.trackProgress = nearestIndex;

        // Detect if we've made progress
        if (vehicle.trackProgress > oldProgress) {
            vehicle.framesWithoutProgress = 0;
        } else {
            vehicle.framesWithoutProgress++;
        }

        // Track deviation from center
        vehicle.centerDeviation = minDist;

        // Handle lap completion
        if (nearestIndex < 10 && oldProgress > track.path.length - 10) {
            vehicle.lapsCompleted++;
            vehicle.trackProgress = nearestIndex + (vehicle.lapsCompleted * track.path.length);
        }
    }
}
