import { createWorld } from '../dist/simulator/world.js';
import { worldToFrame } from '../dist/simulator/animation.js';
import { stepTraffic } from '../dist/simulator/models/traffic.js';
import { stepFlood } from '../dist/simulator/models/flood.js';
import { stepRescue } from '../dist/simulator/models/rescue.js';
import { advanceSimClock } from '../dist/simulator/models/timing.js';
import { buildMapOverlays } from '../dist/simulator/overlays.js';

const state = {
  candidate: {
    type: 'flood',
    areaLabel: 'G-10 Markaz',
    centroid: { lat: 33.6702, lng: 73.0213 },
  },
  severity: { estimatedImpact: { congestionIndex: 0.82, strandedVehicles: 100 } },
  plan: { actions: [{ type: 'deploy_pumps' }, { type: 'traffic_reroute' }] },
};

const world = createWorld(state, 'test-crisis');
console.log('Initial overlays:', buildMapOverlays(world).map((o) => o.type));

for (let i = 0; i < 5; i++) {
  const dt = advanceSimClock(world);
  stepFlood(world, dt);
  stepTraffic(world, dt);
  stepRescue(world, dt);
  const frame = worldToFrame(world);
  console.log(
    `tick ${frame.tick}: congestion=${frame.metrics.congestionIndex} flood=${frame.metrics.floodCoverageKm2}km² units=${frame.units.length}`
  );
}
