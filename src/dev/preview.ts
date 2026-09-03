// Dev-only visual check: renders client fish at fixed poses for screenshots.
import { SpottedMoray } from '../simulation/SpottedMoray';
import { FrenchGrunt } from '../simulation/FrenchGrunt';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const params = new URLSearchParams(location.search);
const aperture = Number(params.get('aperture') ?? 1.9);

ctx.fillStyle = '#001f3f';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Moray, fully emerged, mouth at the given aperture, gill open
const moray = new SpottedMoray(canvas.width, canvas.height);
moray.calculatePositions(canvas.width, canvas.height);
moray.setMode('active');
for (let i = 0; i < 400; i++) moray.update(canvas.width, canvas.height, 1);
moray.pos = { x: 500, y: 420 };
moray.mouthAperture = aperture;
moray.gillOpen = 1;
moray.mouthGate = 1;
moray.render(ctx);

// Grunt school
const grunt = new FrenchGrunt(canvas.width, canvas.height);
grunt.pos = { x: 1050, y: 380 };
grunt.scale = 3.2;
grunt.gillOpen = 1;
grunt.mouthGate = 1;
grunt.mouthAperture = aperture;
grunt.render(ctx);
