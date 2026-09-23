import { CHECKPOINTS, FORKS, distToTrail } from "./terrain";
import { ROCK_SPOTS, TREE_SPOTS } from "./Trees";

export interface PropCollider {
  x: number;
  z: number;
  r: number;
}

function build(): PropCollider[] {
  const out: PropCollider[] = [];
  for (const s of TREE_SPOTS) {
    if (distToTrail(s.x, s.z) < 1) continue;
    out.push({ x: s.x, z: s.z, r: 0.25 * s.s });
  }
  for (const s of ROCK_SPOTS) {
    if (distToTrail(s.x, s.z) < 1) continue;
    out.push({ x: s.x, z: s.z, r: 0.45 * s.s });
  }
  for (const cp of CHECKPOINTS) {
    if (distToTrail(cp.x + 3.5, cp.z) >= 1) out.push({ x: cp.x + 3.5, z: cp.z, r: 1.0 });
    if (cp.id === "basecamp" && distToTrail(cp.x - 5, cp.z + 3) >= 1) {
      out.push({ x: cp.x - 5, z: cp.z + 3, r: 1.0 });
    }
    if (distToTrail(cp.x - 3.5, cp.z + 1.5) >= 1) out.push({ x: cp.x - 3.5, z: cp.z + 1.5, r: 0.6 });
    if (distToTrail(cp.x, cp.z) >= 1) out.push({ x: cp.x, z: cp.z, r: 0.3 });
  }
  for (const f of FORKS) {
    if (distToTrail(f.x, f.z) >= 1) out.push({ x: f.x, z: f.z, r: 0.3 });
  }
  return out;
}

export const PROP_COLLIDERS: PropCollider[] = build();
