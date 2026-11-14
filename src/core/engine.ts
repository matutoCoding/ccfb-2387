import type { BakeOptions, EvalReport, GraphNode, Recipe, Tile } from './types'
import { clamp } from './math'
import { constantTile, makeTile } from './tile'
import { defOf } from './node_defs'
import { evalNode } from './evaluators'
import { validateGraph } from './validation'

export interface EngineContext {
  size: number
  getInput(nodeId: string, portId: string, size: number): Tile
}

export interface MaterialTiles {
  baseColor: Tile
  roughness: Tile
  metallic: Tile
  height: Tile
  normal: Tile
}

interface CacheEntry {
  key: string
  tile: Tile
}

function nodeKey(node: GraphNode, seed: number, size: number): string {
  return `${seed}:${size}:${node.type}:${JSON.stringify(node.params)}`
}

// 高度瓦片 → 法线（切线空间），强度可调
function heightToNormal(height: Tile, strength: number): Tile {
  const s = height.size
  const normal = makeTile('vec3', s)
  const at = (x: number, y: number): number => height.data[y * s + x]
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const l = at((x - 1 + s) % s, y)
      const r = at((x + 1) % s, y)
      const d = at(x, (y - 1 + s) % s)
      const u = at(x, (y + 1) % s)
      const dx = (r - l) * strength
      const dy = (u - d) * strength
      const nx = -dx
      const ny = -dy
      const nz = 1
      const inv = 1 / Math.hypot(nx, ny, nz)
      const i = (y * s + x) * 3
      normal.data[i] = nx * inv * 0.5 + 0.5
      normal.data[i + 1] = ny * inv * 0.5 + 0.5
      normal.data[i + 2] = nz * inv * 0.5 + 0.5
    }
  }
  return normal
}

export class GraphEngine {
  private cache = new Map<string, CacheEntry>()

  // 找到 dirtyId 的全部下游（含自身），仅重算这部分节点
  private affectedNodes(recipe: Recipe, dirtyId: string, validEdges: Set<string>): Set<string> {
    const result = new Set<string>([dirtyId])
    let changed = true
    while (changed) {
      changed = false
      for (const edge of recipe.edges) {
        if (!validEdges.has(edge.id)) continue
        if (result.has(edge.fromNode) && !result.has(edge.toNode)) {
          result.add(edge.toNode)
          changed = true
        }
      }
    }
    return result
  }

  evaluate(recipe: Recipe, size: number, dirtyId?: string): { material: MaterialTiles; report: EvalReport } {
    const t0 = performance.now()
    const validation = validateGraph(recipe)
    const validEdges = new Set(
      recipe.edges.filter((e) => !validation.brokenEdgeIds.has(e.id)).map((e) => e.id),
    )
    const affected = dirtyId ? this.affectedNodes(recipe, dirtyId, validEdges) : null
    const tileMap = new Map<string, Map<string, Tile>>()
    const timings: Record<string, number> = {}

    const ctx: EngineContext = {
      size,
      getInput: (nodeId, portId) => {
        const def = defOf(recipe.nodes.find((n) => n.id === nodeId)!.type)
        const portDef = def.inputs.find((p) => p.id === portId)!
        const edge = recipe.edges.find((e) => e.toNode === nodeId && e.toPort === portId)
        if (edge && validEdges.has(edge.id)) {
          const upstream = tileMap.get(edge.fromNode)?.get(edge.fromPort)
          if (upstream) {
            const outPortDef = defOf(recipe.nodes.find((n) => n.id === edge.fromNode)!.type)
              .outputs.find((p) => p.id === edge.fromPort)!
            if (outPortDef.type === portDef.type) return upstream
            // 引擎层兜底适配（理论上 validate 已保证兼容）
            if (outPortDef.type === 'float') {
              const t = makeTile(portDef.type, size)
              const ch = t.kind === 'vec2' ? 2 : t.kind === 'vec3' ? 3 : 4
              for (let i = 0; i < size * size; i++)
                for (let c = 0; c < ch; c++) t.data[i * ch + c] = upstream.data[i]
              return t
            }
          }
        }
        // 坏连线/断连：使用端口兜底值，保证后续节点照常出图
        return constantTile(portDef.type, size, portDef.fallback ?? [0])
      },
    }

    for (const node of validation.topoOrder) {
      if (node.type === 'output') continue
      const key = nodeKey(node, recipe.seed, size)
      const cached = this.cache.get(node.id)
      const cacheValid = cached !== undefined && cached.key === key && cached.tile.size === size
      // 受影响子图之外，或参数未变的节点，直接复用缓存
      const outsideAffected = affected !== null && !affected.has(node.id)
      if (cacheValid && (outsideAffected || affected === null)) {
        const ports = new Map<string, Tile>()
        defOf(node.type).outputs.forEach((p) => ports.set(p.id, cached!.tile))
        tileMap.set(node.id, ports)
        timings[node.id] = 0
        continue
      }
      const t1 = performance.now()
      const tile = evalNode(node, ctx, recipe.seed)
      timings[node.id] = performance.now() - t1
      this.cache.set(node.id, { key, tile })
      const ports = new Map<string, Tile>()
      defOf(node.type).outputs.forEach((p) => ports.set(p.id, tile))
      tileMap.set(node.id, ports)
    }

    const output = recipe.nodes.find((n) => n.type === 'output')
    const outputTile = (portId: string): Tile => ctx.getInput(output!.id, portId, size)
    const height = outputTile('height')
    const strength = ((output?.params['normalStrength'] ?? 1.5) as number)
    const material: MaterialTiles = {
      baseColor: outputTile('baseColor'),
      roughness: outputTile('roughness'),
      metallic: outputTile('metallic'),
      height,
      normal: heightToNormal(height, strength),
    }

    return {
      material,
      report: {
        timings,
        brokenEdges: validation.broken.map((b) => b.edgeId),
        ms: performance.now() - t0,
      },
    }
  }

  // 分瓦片烘焙，每块之间让出事件循环以响应取消
  async bake(recipe: Recipe, options: BakeOptions, signal: { cancelled: boolean }, onProgress?: (p: number) => void): Promise<{
    baseColor: globalThis.ImageData
    normal: globalThis.ImageData
    packed: globalThis.ImageData
    height: globalThis.ImageData
    report: EvalReport
  }> {
    const size = options.size
    const { material, report } = this.evaluate(recipe, size)
    const baseColor = new ImageData(size, size)
    const normal = new ImageData(size, size)
    const packed = new ImageData(size, size)
    const heightImg = new ImageData(size, size)
    const tileSize = 64
    for (let ty = 0; ty < size; ty += tileSize) {
      if (signal.cancelled) throw new Error('烘焙已取消')
      for (let tx = 0; tx < size; tx += tileSize) {
        this.writeBakeTile(material, size, tx, ty, tileSize, baseColor, normal, packed, heightImg)
      }
      onProgress?.((ty + tileSize) / size)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    return { baseColor, normal, packed, heightImg, report }
  }

  private writeBakeTile(
    material: MaterialTiles,
    size: number,
    tx: number,
    ty: number,
    tileSize: number,
    baseColor: globalThis.ImageData,
    normal: globalThis.ImageData,
    packed: globalThis.ImageData,
    heightImg: globalThis.ImageData,
  ): void {
    const xMax = Math.min(tx + tileSize, size)
    const yMax = Math.min(ty + tileSize, size)
    for (let y = ty; y < yMax; y++) {
      for (let x = tx; x < xMax; x++) {
        const idx = y * size + x
        const pi = idx * 4
        baseColor.data[pi] = clamp(material.baseColor.data[idx * 3], 0, 1) * 255
        baseColor.data[pi + 1] = clamp(material.baseColor.data[idx * 3 + 1], 0, 1) * 255
        baseColor.data[pi + 2] = clamp(material.baseColor.data[idx * 3 + 2], 0, 1) * 255
        baseColor.data[pi + 3] = 255
        normal.data[pi] = material.normal.data[idx * 3] * 255
        normal.data[pi + 1] = material.normal.data[idx * 3 + 1] * 255
        normal.data[pi + 2] = material.normal.data[idx * 3 + 2] * 255
        normal.data[pi + 3] = 255
        // R=1 G=粗糙度 B=金属度 A=1
        packed.data[pi] = 255
        packed.data[pi + 1] = clamp(material.roughness.data[idx], 0, 1) * 255
        packed.data[pi + 2] = clamp(material.metallic.data[idx], 0, 1) * 255
        packed.data[pi + 3] = 255
        const h = clamp(material.height.data[idx], 0, 1) * 255
        heightImg.data[pi] = h
        heightImg.data[pi + 1] = h
        heightImg.data[pi + 2] = h
        heightImg.data[pi + 3] = 255
      }
    }
  }

  clearCache(): void {
    this.cache.clear()
  }
}
