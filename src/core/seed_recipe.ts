import type { GraphEdge, GraphNode, ParamValue, Recipe } from './types'
import { NODE_DEFS } from './node_defs'

let seq = 0
export function uid(prefix = 'n'): string {
  seq += 1
  return `${prefix}_${Date.now().toString(36)}_${seq}`
}

export function createNode(type: string, x: number, y: number, overrides: Record<string, ParamValue> = {}): GraphNode {
  const def = NODE_DEFS[type]
  const params: Record<string, ParamValue> = {}
  for (const p of def.params) params[p.key] = structuredClone(p.default)
  return { id: uid(type), type, x, y, params: { ...params, ...overrides } }
}

function edge(fromNode: string, fromPort: string, toNode: string, toPort: string): GraphEdge {
  return { id: uid('e'), fromNode, fromPort, toNode, toPort }
}

// 旧铜把手 + 铜绿：同种子重建结果一致
export function buildDefaultRecipe(seed = 2387): Recipe {
  const uv = createNode('texcoord', 40, 60)
  const largeNoise = createNode('fbm_noise', 40, 200, { scale: 5, octaves: 4, seedOffset: 11 })
  const fineNoise = createNode('value_noise', 40, 360, { scale: 28, seedOffset: 37 })
  const curvature = createNode('curvature', 340, 480, { mode: 'cavities', radius: 2 })
  const copperGradient = createNode('gradient_map', 340, 120, {
    gradient: [
      { t: 0, color: [0.16, 0.09, 0.05] },
      { t: 0.55, color: [0.48, 0.3, 0.15] },
      { t: 1, color: [0.82, 0.56, 0.3] },
    ],
  })
  const patinaColor = createNode('constant_color', 340, 300, { color: [0.13, 0.3, 0.22] })
  const patinaMask = createNode('ramp_map', 620, 300, {
    ramp: [
      { t: 0, value: 0.85 },
      { t: 0.45, value: 0.35 },
      { t: 1, value: 0.05 },
    ],
  })
  const grime = createNode('grime', 900, 200, { threshold: 0.42, softness: 0.22, strength: 0.75 })
  const roughRamp = createNode('ramp_map', 620, 480, {
    ramp: [
      { t: 0, value: 0.85 },
      { t: 0.5, value: 0.55 },
      { t: 1, value: 0.3 },
    ],
  })
  const metalRamp = createNode('ramp_map', 620, 620, {
    ramp: [
      { t: 0, value: 0.5 },
      { t: 0.5, value: 0.85 },
      { t: 1, value: 0.98 },
    ],
  })
  const heightNode = createNode('ramp_map', 40, 620, {
    ramp: [
      { t: 0, value: 0.3 },
      { t: 1, value: 0.7 },
    ],
  })
  const output = createNode('output', 1200, 320, { normalStrength: 1.6 })

  const nodes = [
    uv, largeNoise, fineNoise, curvature, copperGradient, patinaColor,
    patinaMask, grime, roughRamp, metalRamp, heightNode, output,
  ]
  const edges = [
    edge(uv.id, 'uv', largeNoise.id, 'uv'),
    edge(uv.id, 'uv', fineNoise.id, 'uv'),
    edge(largeNoise.id, 'value', copperGradient.id, 'value'),
    edge(largeNoise.id, 'value', patinaMask.id, 'value'),
    edge(largeNoise.id, 'value', roughRamp.id, 'value'),
    edge(largeNoise.id, 'value', metalRamp.id, 'value'),
    edge(largeNoise.id, 'value', heightNode.id, 'value'),
    edge(heightNode.id, 'value', curvature.id, 'height'),
    edge(patinaMask.id, 'value', grime.id, 'mask'),
    edge(copperGradient.id, 'color', grime.id, 'base'),
    edge(patinaColor.id, 'color', grime.id, 'stain'),
    edge(grime.id, 'color', output.id, 'baseColor'),
    edge(roughRamp.id, 'value', output.id, 'roughness'),
    edge(metalRamp.id, 'value', output.id, 'metallic'),
    edge(heightNode.id, 'value', output.id, 'height'),
  ]
  const now = Date.now()
  return {
    id: uid('recipe'),
    name: '旧铜把手 · 铜绿配方',
    seed,
    nodes,
    edges,
    createdAt: now,
    updatedAt: now,
  }
}
