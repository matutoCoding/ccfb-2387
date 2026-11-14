import type { ColorStop, RampStop, Tile, TileKind } from './types'
import { clamp, lerp } from './math'

export function makeTile(kind: TileKind, size: number): Tile {
  const channels = kind === 'float' ? 1 : kind === 'vec2' ? 2 : kind === 'vec3' ? 3 : 4
  return { kind, size, data: new Float32Array(size * size * channels) }
}

export function makeTileLike(src: Tile): Tile {
  return makeTile(src.kind, src.size)
}

// 回绕采样，保证 UV 接缝处连续
export function sampleTile(tile: Tile, u: number, v: number, channel: number): number {
  const s = tile.size
  const x = ((u % 1) + 1) % 1 * s
  const y = ((v % 1) + 1) % 1 * s
  const x0 = Math.floor(x) % s
  const y0 = Math.floor(y) % s
  const x1 = (x0 + 1) % s
  const y1 = (y0 + 1) % s
  const fx = x - Math.floor(x)
  const fy = y - Math.floor(y)
  const ch = channelCount(tile)
  const i00 = (y0 * s + x0) * ch + channel
  const i10 = (y0 * s + x1) * ch + channel
  const i01 = (y1 * s + x0) * ch + channel
  const i11 = (y1 * s + x1) * ch + channel
  const d = tile.data
  return lerp(lerp(d[i00], d[i10], fx), lerp(d[i01], d[i11], fx), fy)
}

export function channelCount(tile: Tile): number {
  return tile.kind === 'float' ? 1 : tile.kind === 'vec2' ? 2 : tile.kind === 'vec3' ? 3 : 4
}

export function sampleGradient(stops: ColorStop[], t: number): [number, number, number] {
  const x = clamp(t, 0, 1)
  if (x <= stops[0].t) return [...stops[0].color]
  const last = stops[stops.length - 1]
  if (x >= last.t) return [...last.color]
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (x >= a.t && x <= b.t) {
      const k = (x - a.t) / Math.max(1e-6, b.t - a.t)
      return [
        lerp(a.color[0], b.color[0], k),
        lerp(a.color[1], b.color[1], k),
        lerp(a.color[2], b.color[2], k),
      ]
    }
  }
  return [...last.color]
}

export function sampleRamp(stops: RampStop[], t: number): number {
  const x = clamp(t, 0, 1)
  if (x <= stops[0].t) return stops[0].value
  const last = stops[stops.length - 1]
  if (x >= last.t) return last.value
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (x >= a.t && x <= b.t) {
      const k = (x - a.t) / Math.max(1e-6, b.t - a.t)
      return lerp(a.value, b.value, k)
    }
  }
  return last.value
}

// 把 float 瓦片广播成多通道（坏连线兜底用）
export function broadcast(src: Tile, targetKind: TileKind): Tile {
  if (src.kind === targetKind) return src
  const out = makeTile(targetKind, src.size)
  const outCh = channelCount(out)
  for (let i = 0; i < src.size * src.size; i++) {
    const v = src.data[i]
    for (let c = 0; c < outCh; c++) out.data[i * outCh + c] = v
  }
  return out
}

export function constantTile(kind: TileKind, size: number, values: number[]): Tile {
  const t = makeTile(kind, size)
  const ch = channelCount(t)
  for (let i = 0; i < size * size; i++) {
    for (let c = 0; c < ch; c++) t.data[i * ch + c] = values[c] ?? values[0]
  }
  return t
}
