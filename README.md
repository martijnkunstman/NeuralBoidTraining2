# Vehicle Simulation

A 2D vehicle simulation built with Vite, TypeScript, and RapierJS.

## Features

- Realistic 2D physics using `@dimforge/rapier2d-compat`.
- Vehicle control with Arrow Keys:
  - **Up**: Accelerate
  - **Down**: Brake/Reverse
  - **Left/Right**: Steer
- Visualization:
  - Triangle representing the vehicle.
  - Blue dots indicating active inputs.
  - Velocity vector visualization.
  - Infinite grid background.

## Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run development server:
   ```bash
   npm run dev
   ```

## Deployment

Deploy to GitHub Pages:
```bash
npm run deploy
```