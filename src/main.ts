import RAPIER from '@dimforge/rapier2d-compat';
import { World } from './World';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { ConfigPanel } from './ConfigPanel';

async function main() {
    await RAPIER.init();
    console.log('Rapier initialized');
    document.getElementById('debug')!.innerText = '';

    const input = new Input();
    const world = new World({ x: 0, y: 0 }); // Zero gravity
    const renderer = new Renderer();
    new ConfigPanel(world.vehicle);

    function loop() {
        world.update(input);
        renderer.render(world, input);
        requestAnimationFrame(loop);
    }

    loop();
}

main();
