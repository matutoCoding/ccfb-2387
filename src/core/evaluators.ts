import type { ColorStop, GraphNode, RampStop, Tile } from './types'
import { channelCount, constantTile, makeTile, sampleGradient, sampleRamp, sampleTile } from './tile'
import { fbm2, smoothstep, valueNoise2 } from './math'
import type { EngineContext } from './engine'

function num(node: GraphNode, key: string): number {
  return node.params[key] as number
}

function asGradient(node: GraphNode, key: string): ColorStop[] {
  return node.params[key] as ColorStop[]
}

function asRamp(node: GraphNode, key: string): RampStop[] {
  return node.params[key] as RampStop[]
}

// 把任意瓦片转成目标类型；float 广播，低通道按第 0 通道补齐
function adapt(tile: Tile, target: Tile['kind']): Tile {
  if (tile.kind === target) return tile
  if (tile.kind === 'float') return broadcast(tile, target)
  const out = makeTile(target, tile.size)
  const srcCh = channelCount(tile)
  const dstCh = channelCount(out)
  for (let i = 0; i < tile.size * tile.size; i++) {
    for (let c = 0; c < dstCh; c++) {
      const srcC = Math.min(c, srcCh - 1)
      out.data[i * dstCh + c] = tile.data[i * srcCh + srcC]
    }
  }
  return out
}

export function evalNode(node: GraphNode, ctx: EngineContext, seed: number): Tile {
  const size = ctx.size
  const input = (portId: string): Tile => ctx.getInput(node.id, portId, size)

  switch (node.type) {
    case 'texcoord': {
      const t = makeTile('vec2', size)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 2
          t.data[i] = (x + 0.5) / size
          t.data[i + 1] = (y + 0.5) / size
        }
      }
      return t
    }

    case 'value_noise': {
      const uv = adapt(input('uv'), 'vec2')
      const scale = num(node, 'scale')
      const s = seed + num(node, 'seedOffset')
      const t = makeTile('float', size)
      for (let i = 0; i < size * size; i++) {
        t.data[i] = valueNoise2(uv.data[i * 2] * scale, uv.data[i * 2 + 1] * scale, s)
      }
      return t
    }

    case 'fbm_noise': {
      const uv = adapt(input('uv'), 'vec2')
      const scale = num(node, 'scale')
      const octaves = num(node, 'octaves')
      const s = seed + num(node, 'seedOffset')
      const t = makeTile('float', size)
      for (let i = 0; i < size * size; i++) {
        t.data[i] = fbm2(uv.data[i * 2] * scale, uv.data[i * 2 + 1] * scale, s, octaves)
      }
      return t
    }

    case 'curvature': {
      const height = adapt(input('height'), 'float')
      const r = num(node, 'radius')
      const step = r / size
      const mode = node.params['mode'] as string
      const t = makeTile('float', size)
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const u = (x + 0.5) / size
          const v = (y + 0.5) / size
          const center = height.data[y * size + x]
          const l = sampleTile(height, u - step, v, 0)
          const rr = sampleTile(height, u + step, v, 0)
          const d = sampleTile(height, u, v - step, 0)
          const uP = sampleTile(height, u, v + step, 0)
          const lap = center * 4 - l - rr - d - uP
          let mask = 0
          if (mode === 'edges') mask = smoothstep(0.002, 0.05, -lap)
          else if (mode === 'cavities') mask = smoothstep(0.002, 0.05, lap)
          else if (mode === 'inverted') mask = 1 - Math.tanh(Math.abs(lap) * 40)
          else mask = Math.tanh(Math.abs(lap) * 40)
          t.data[y * size + x] = mask
        }
      }
      return t
    }

    case 'grime': {
      const base = adapt(input('base'), 'vec3')
      const stain = adapt(input('stain'), 'vec3')
      const maskT = adapt(input('mask'), 'float')
      const threshold = num(node, 'threshold')
      const softness = num(node, 'softness')
      const strength = num(node, 'strength')
      const t = makeTile('vec3', size)
      for (let i = 0; i < size * size; i++) {
        const m = smoothstep(threshold - softness, threshold + softness, maskT.data[i]) * strength
        for (let c = 0; c < 3; c++) {
          const b = base.data[i * 3 + c]
          t.data[i * 3 + c] = b * (1 - m) + stain.data[i * 3 + c] * m
        }
      }
      return t
    }

    case 'gradient_map': {
      const value = adapt(input('value'), 'float')
      const stops = asGradient(node, 'gradient')
      const t = makeTile('vec3', size)
      for (let i = 0; i < size * size; i++) {
        const [r, g, b] = sampleGradient(stops, value.data[i])
        t.data[i * 3] = r
        t.data[i * 3 + 1] = g
        t.data[i * 3 + 2] = b
      }
      return t
    }

    case 'ramp_map': {
      const value = adapt(input('value'), 'float')
      const stops = asRamp(node, 'ramp')
      const t = makeTile('float', size)
      for (let i = 0; i < size * size; i++) t.data[i] = sampleRamp(stops, value.data[i])
      return t
    }

    case 'constant_color': {
      const color = node.params['color'] as number[]
      return constantTile('vec3', size, [color[0], color[1], color[2]])
    }

    case 'output':
      // 输出节点不产生瓦片，材质通道由 engine 直接收集
      return makeTile('float', size)

    default:
      throw new Error(`未实现的节点求值: ${node.type}`)
  }
}
