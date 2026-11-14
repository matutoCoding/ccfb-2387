import { createMemo, createSignal, For, onMount } from 'solid-js'
import type { GraphEdge, GraphNode, PortType } from '~/core/types'
import { NODE_DEFS } from '~/core/node_defs'
import { createNode, uid } from '~/core/seed_recipe'
import { mutateRecipe, currentRecipe, touchRecipe, persistRecipe } from '~/core/store'
import { scheduleEvaluation } from '~/core/evaluation'
import { validateGraph } from '~/core/validation'
import './node_canvas.css'

const PORT_COLORS: Record<PortType, string> = {
  float: '#38bdf8',
  vec2: '#a78bfa',
  vec3: '#f472b6',
  rgba: '#34d399',
}

const NODE_W = 176

interface DragState {
  nodeId: string
  offsetX: number
  offsetY: number
}

interface LinkDraft {
  fromNode: string
  fromPort: string
  x: number
  y: number
}

// 模块级选中态：供外部参数面板联动
export const selectedNodeId = createSignal<string | null>(null)

function portCenter(canvas: HTMLElement | undefined, nodeId: string, portId: string): [number, number] {
  if (!canvas) return [0, 0]
  const el = canvas.querySelector(`[data-port="${nodeId}:${portId}"]`) as HTMLElement | null
  if (!el) return [0, 0]
  const canvasRect = canvas.getBoundingClientRect()
  const rect = el.getBoundingClientRect()
  return [rect.left - canvasRect.left + rect.width / 2, rect.top - canvasRect.top + rect.height / 2]
}

export default function NodeCanvas() {
  const [selectedId, setSelectedId] = selectedNodeId
  const [drag, setDrag] = createSignal<DragState | null>(null)
  const [link, setLink] = createSignal<LinkDraft | null>(null)
  const [canvasEl, setCanvasEl] = createSignal<HTMLElement>()

  const validation = createMemo(() => validateGraph(currentRecipe()))
  const brokenSet = createMemo((): Set<string> => new Set(validation().broken.map((b) => b.edgeId)))
  // 连线路径依赖节点坐标，拖拽时配方坐标变化即触发重新测量
  const pathVersion = createMemo(() =>
    currentRecipe().nodes.map((n) => `${n.id}:${Math.round(n.x)},${Math.round(n.y)}`).join('|'),
  )

  onMount(() => scheduleEvaluation())

  const edgePath = (edge: GraphEdge): string => {
    void pathVersion()
    const [x1, y1] = portCenter(canvasEl(), edge.fromNode, edge.fromPort)
    const [x2, y2] = portCenter(canvasEl(), edge.toNode, edge.toPort)
    const dx = Math.max(48, Math.abs(x2 - x1) * 0.5)
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
  }

  const onMouseMove = (e: MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const d = drag()
    if (d) {
      touchRecipe((draft) => {
        const target = draft.nodes.find((n) => n.id === d.nodeId)!
        target.x = x - d.offsetX
        target.y = y - d.offsetY
      })
      return
    }
    const l = link()
    if (l) setLink({ ...l, x, y })
  }

  const onMouseUp = () => {
    if (drag()) persistRecipe()
    setDrag(null)
    setLink(null)
  }

  const beginDragNode = (e: MouseEvent, node: GraphNode) => {
    e.stopPropagation()
    setSelectedId(node.id)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDrag({
      nodeId: node.id,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    })
  }

  const beginLink = (e: MouseEvent, node: GraphNode, portId: string) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).closest('.node-canvas')!.getBoundingClientRect()
    setLink({
      fromNode: node.id,
      fromPort: portId,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  const completeLink = (e: MouseEvent, node: GraphNode, portId: string) => {
    e.stopPropagation()
    const l = link()
    if (!l || l.fromNode === node.id) {
      setLink(null)
      return
    }
    // 类型不匹配/成环的连线照样保留，由 validation 标红
    mutateRecipe((draft) => {
      draft.edges = draft.edges.filter((ed) => !(ed.toNode === node.id && ed.toPort === portId))
      draft.edges.push({
        id: uid('e'),
        fromNode: l.fromNode,
        fromPort: l.fromPort,
        toNode: node.id,
        toPort: portId,
      })
    })
    setLink(null)
    scheduleEvaluation()
  }

  const addNode = (type: string) => {
    mutateRecipe((draft) => {
      draft.nodes.push(createNode(type, 120 + Math.random() * 160, 120 + Math.random() * 160))
    })
    scheduleEvaluation()
  }

  const duplicateNode = (node: GraphNode) => {
    mutateRecipe((draft) => {
      const copy = structuredClone(node)
      copy.id = uid(node.type)
      copy.x += 32
      copy.y += 32
      draft.nodes.push(copy)
    })
    scheduleEvaluation()
  }

  const deleteNode = (node: GraphNode) => {
    mutateRecipe((draft) => {
      draft.nodes = draft.nodes.filter((n) => n.id !== node.id)
      draft.edges = draft.edges.filter((ed) => ed.fromNode !== node.id && ed.toNode !== node.id)
    })
    setSelectedId(null)
    scheduleEvaluation()
  }

  const deleteEdge = (edge: GraphEdge) => {
    mutateRecipe((draft) => {
      draft.edges = draft.edges.filter((e) => e.id !== edge.id)
    })
    scheduleEvaluation()
  }

  const brokenReason = (edgeId: string): string =>
    validation().broken.find((b) => b.edgeId === edgeId)?.reason ?? ''

  const addableTypes = createMemo(() => Object.values(NODE_DEFS).filter((d) => d.type !== 'output'))

  return (
    <div class="node-canvas-wrap">
      <div class="canvas-toolbar">
        <select value="" onChange={(e) => e.currentTarget.value && addNode(e.currentTarget.value)}>
          <option value="">添加节点…</option>
          <For each={addableTypes()}>
            {(def) => <option value={def.type}>{def.category} · {def.label}</option>}
          </For>
        </select>
        <div class="toolbar-spacer" />
        <span class="muted">坏连线 {validation().broken.length} 条 · 节点 {currentRecipe().nodes.length}</span>
      </div>
      <div
        class="node-canvas"
        ref={setCanvasEl}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseDown={() => setSelectedId(null)}
      >
        <svg class="edge-layer">
          <For each={currentRecipe().edges}>
            {(edge) => (
              <g classList={{ 'edge-group': true, broken: brokenSet().has(edge.id) }}>
                <path class="edge-hit" d={edgePath(edge)} onClick={() => deleteEdge(edge)} />
                <path class="edge-line" d={edgePath(edge)} />
                <title>{brokenSet().has(edge.id) ? `${brokenReason(edge.id)}（点击删除）` : '点击删除连线'}</title>
              </g>
            )}
          </For>
          {link() && (
            <path
              class="edge-line draft"
              d={`M ${link()!.x} ${link()!.y} L ${link()!.x} ${link()!.y}`}
            />
          )}
        </svg>

        <For each={currentRecipe().nodes}>
          {(node) => {
            const def = NODE_DEFS[node.type]
            return (
              <div
                class="node-card card"
                classList={{ selected: selectedId() === node.id }}
                style={{ left: `${node.x}px`, top: `${node.y}px`, width: `${NODE_W}px` }}
                onMouseDown={(e) => beginDragNode(e, node)}
              >
                <div class="node-header">
                  <span>{def.label}</span>
                  <span class="node-type">{def.category}</span>
                </div>
                <div class="node-ports">
                  <For each={def.inputs}>
                    {(port) => (
                      <div
                        class="port-row"
                        data-port={`${node.id}:${port.id}`}
                        onMouseUp={(e) => completeLink(e, node, port.id)}
                      >
                        <span class="port-dot" style={{ background: PORT_COLORS[port.type] }} />
                        <span class="port-label">{port.label}</span>
                      </div>
                    )}
                  </For>
                  <For each={def.outputs}>
                    {(port) => (
                      <div
                        class="port-row output"
                        data-port={`${node.id}:${port.id}`}
                        onMouseDown={(e) => beginLink(e, node, port.id)}
                      >
                        <span class="port-label">{port.label}</span>
                        <span class="port-dot" style={{ background: PORT_COLORS[port.type] }} />
                      </div>
                    )}
                  </For>
                </div>
                {selectedId() === node.id && node.type !== 'output' && (
                  <div class="node-actions">
                    <button class="ghost" onMouseDown={(e) => e.stopPropagation()} onClick={() => duplicateNode(node)}>复制</button>
                    <button class="ghost danger" onMouseDown={(e) => e.stopPropagation()} onClick={() => deleteNode(node)}>删除</button>
                  </div>
                )}
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}
