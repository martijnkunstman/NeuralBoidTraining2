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
    world.init();
    const renderer = new Renderer();
    new ConfigPanel(world);

    function loop() {
        world.update(input);
        renderer.render(world, input);
        input.reset();
        requestAnimationFrame(loop);
    }

    loop();
}

main();
