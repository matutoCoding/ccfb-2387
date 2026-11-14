import type { GraphEdge, GraphNode, PortType, Recipe } from './types'
import { PORT_CHANNELS } from './types'
import { defOf } from './node_defs'

export interface BrokenEdge {
  edgeId: string
  reason: string
}

// 连线类型校验：同源同类型通过；float 可向任意端口广播；vec3 可升 rgba；其余拒绝
export function isTypeCompatible(from: PortType, to: PortType): boolean {
  if (from === to) return true
  if (from === 'float') return true
  if (from === 'vec3' && to === 'rgba') return true
  return PORT_CHANNELS[from] <= PORT_CHANNELS[to] && to !== 'vec2'
}

function findEdgeTypeIssues(recipe: Recipe): BrokenEdge[] {
  const nodeMap = new Map(recipe.nodes.map((n) => [n.id, n]))
  const issues: BrokenEdge[] = []
  for (const edge of recipe.edges) {
    const fromNode = nodeMap.get(edge.fromNode)
    const toNode = nodeMap.get(edge.toNode)
    if (!fromNode || !toNode) {
      issues.push({ edgeId: edge.id, reason: '端点节点已删除' })
      continue
    }
    const fromDef = defOf(fromNode.type)
    const toDef = defOf(toNode.type)
    const outPort = fromDef.outputs.find((p) => p.id === edge.fromPort)
    const inPort = toDef.inputs.find((p) => p.id === edge.toPort)
    if (!outPort || !inPort) {
      issues.push({ edgeId: edge.id, reason: '端口不存在' })
      continue
    }
    if (!isTypeCompatible(outPort.type, inPort.type)) {
      issues.push({ edgeId: edge.id, reason: `类型不匹配 ${outPort.type} → ${inPort.type}` })
    }
  }
  return issues
}

// DFS 三色标记：白未访问 / 灰在栈上 / 黑完成；回边即环
function findCycleEdges(recipe: Recipe): BrokenEdge[] {
  const adjacency = new Map<string, GraphEdge[]>()
  for (const node of recipe.nodes) adjacency.set(node.id, [])
  for (const edge of recipe.edges) {
    if (adjacency.has(edge.fromNode) && adjacency.has(edge.toNode)) {
      adjacency.get(edge.fromNode)!.push(edge)
    }
  }
  const color = new Map<string, 0 | 1 | 2>()
  for (const node of recipe.nodes) color.set(node.id, 0)
  const cycleEdges: BrokenEdge[] = []
  const visit = (nodeId: string) => {
    color.set(nodeId, 1)
    for (const edge of adjacency.get(nodeId) ?? []) {
      if (cycleEdges.some((e) => e.edgeId === edge.id)) continue
      const target = edge.toNode
      const state = color.get(target)
      if (state === 1) {
        cycleEdges.push({ edgeId: edge.id, reason: '检测到循环连线' })
      } else if (state === 0) {
        visit(target)
      }
    }
    color.set(nodeId, 2)
  }
  for (const node of recipe.nodes) {
    if (color.get(node.id) === 0) visit(node.id)
  }
  return cycleEdges
}

export interface ValidationResult {
  broken: BrokenEdge[]
  brokenEdgeIds: Set<string>
  // 拓扑序：参与环的节点不会出现，其下游按坏连线兜底处理
  topoOrder: GraphNode[]
}

export function validateGraph(recipe: Recipe): ValidationResult {
  const broken = [...findEdgeTypeIssues(recipe), ...findCycleEdges(recipe)]
  const brokenEdgeIds = new Set(broken.map((b) => b.edgeId))
  const nodeMap = new Map(recipe.nodes.map((n) => [n.id, n]))
  const indegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()
  for (const node of recipe.nodes) {
    indegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }
  for (const edge of recipe.edges) {
    if (brokenEdgeIds.has(edge.id)) continue
    if (!nodeMap.has(edge.fromNode) || !nodeMap.has(edge.toNode)) continue
    indegree.set(edge.toNode, (indegree.get(edge.toNode) ?? 0) + 1)
    adjacency.get(edge.fromNode)!.push(edge.toNode)
  }
  const queue = recipe.nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id)
  const topoOrder: GraphNode[] = []
  while (queue.length) {
    const id = queue.shift()!
    const node = nodeMap.get(id)
    if (!node) continue
    topoOrder.push(node)
    for (const nextId of adjacency.get(id) ?? []) {
      const d = (indegree.get(nextId) ?? 0) - 1
      indegree.set(nextId, d)
      if (d === 0) queue.push(nextId)
    }
  }
  return { broken, brokenEdgeIds, topoOrder }
}
