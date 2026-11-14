// 领域类型定义：节点图、配方、求值瓦片、烘焙与版本

export type PortType = 'float' | 'vec2' | 'vec3' | 'rgba'
export type TileKind = PortType

export type ParamType = 'number' | 'select' | 'color' | 'gradient' | 'ramp' | 'boolean'
export type ParamValue = number | string | boolean | ColorStop[] | RampStop[]

export interface ColorStop {
  t: number
  color: [number, number, number]
}

export interface RampStop {
  t: number
  value: number
}

export interface ParamDef {
  key: string
  label: string
  type: ParamType
  default: ParamValue
  min?: number
  max?: number
  step?: number
  options?: { label: string; value: string }[]
}

export interface PortDef {
  id: string
  label: string
  type: PortType
  // 断连或坏连线时使用的兜底值（按通道）
  fallback?: number[]
}

export interface NodeDef {
  type: string
  label: string
  category: string
  inputs: PortDef[]
  outputs: PortDef[]
  params: ParamDef[]
}

export interface GraphNode {
  id: string
  type: string
  x: number
  y: number
  params: Record<string, ParamValue>
}

export interface GraphEdge {
  id: string
  fromNode: string
  fromPort: string
  toNode: string
  toPort: string
}

export interface Recipe {
  id: string
  name: string
  seed: number
  nodes: GraphNode[]
  edges: GraphEdge[]
  createdAt: number
  updatedAt: number
}

export interface Tile {
  kind: TileKind
  size: number
  data: Float32Array
}

export interface EvalReport {
  timings: Record<string, number>
  brokenEdges: string[]
  ms: number
}

export interface RecipeVersion {
  id: string
  recipeId: string
  label: string
  snapshot: Recipe
  createdAt: number
}

export interface DiffEntry {
  path: string
  kind: 'add' | 'remove' | 'change'
  before: unknown
  after: unknown
}

export type BakeSize = 256 | 512 | 1024 | 2048

export interface BakeOptions {
  size: BakeSize
  // 通道打包模板：R=1 G=粗糙度 B=金属度 A=1
  pack: 'orm'
}

export interface BakeResult {
  baseColor: ImageData
  normal: ImageData
  packed: ImageData
  height: ImageData
  brokenEdges: string[]
  ms: number
}

export const PORT_CHANNELS: Record<PortType, number> = {
  float: 1,
  vec2: 2,
  vec3: 3,
  rgba: 4,
}
