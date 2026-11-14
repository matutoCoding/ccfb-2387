import { createSignal, For, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import NodeCanvas, { selectedNodeId } from '~/components/node_canvas'
import ParameterPanel from '~/components/parameter_panel'
import PreviewThumb from '~/components/preview_thumb'
import { currentRecipe, mutateRecipe, redoRecipe, undoRecipe, useRecipeStore } from '~/core/store'
import { buildDefaultRecipe } from '~/core/seed_recipe'
import { validateGraph } from '~/core/validation'
import { useEvaluation } from '~/core/evaluation'
import './editor_page.css'

export default function EditorPage() {
  const navigate = useNavigate()
  const { history } = useRecipeStore()
  const { report } = useEvaluation()
  const [seedInput, setSeedInput] = createSignal(String(currentRecipe().seed))

  const rebuildFromSeed = () => {
    const seed = Number(seedInput()) || 0
    const fresh = buildDefaultRecipe(seed)
    fresh.id = currentRecipe().id
    fresh.name = currentRecipe().name
    mutateRecipe((draft) => {
      draft.seed = seed
      draft.nodes = fresh.nodes
      draft.edges = fresh.edges
    })
  }

  const randomSeed = () => {
    const seed = Math.floor(Math.random() * 99999)
    setSeedInput(String(seed))
    const fresh = buildDefaultRecipe(seed)
    fresh.id = currentRecipe().id
    fresh.name = currentRecipe().name
    mutateRecipe((draft) => {
      draft.seed = seed
      draft.nodes = fresh.nodes
      draft.edges = fresh.edges
    })
  }

  const rename = (name: string) => {
    mutateRecipe((draft) => {
      draft.name = name
    })
  }

  const broken = () => validateGraph(currentRecipe()).broken

  return (
    <div class="editor-page">
      <div class="editor-toolbar card">
        <input
          class="recipe-name"
          value={currentRecipe().name}
          onChange={(e) => rename(e.currentTarget.value)}
        />
        <div class="seed-group">
          <label>种子</label>
          <input
            class="seed-input"
            type="number"
            value={seedInput()}
            onChange={(e) => setSeedInput(e.currentTarget.value)}
          />
          <button onClick={rebuildFromSeed}>按种子重建</button>
          <button class="ghost" onClick={randomSeed}>随机种子</button>
        </div>
        <div class="toolbar-spacer" />
        <button onClick={undoRecipe} disabled={!history.canUndo}>撤销</button>
        <button onClick={redoRecipe} disabled={!history.canRedo}>重做</button>
        <button class="primary" onClick={() => navigate('/preview')}>实物预览</button>
      </div>

      <div class="editor-main">
        <div class="canvas-column">
          <NodeCanvas />
          <Show when={broken().length > 0}>
            <div class="broken-banner card">
              <strong class="danger-text">坏连线 {broken().length} 条（保留出图，使用端口兜底值）</strong>
              <ul>
                <For each={broken()}>
                  {(item) => <li>{item.reason}</li>}
                </For>
              </ul>
            </div>
          </Show>
        </div>
        <div class="side-column">
          <PreviewThumb />
          <ParameterPanel selectedId={selectedNodeId[0]()} />
        </div>
      </div>
      <Show when={report()}>
        <div class="eval-status muted">
          上次求值 {report()!.ms.toFixed(2)}ms · 坏线 {report()!.brokenEdges.length} 条
        </div>
      </Show>
    </div>
  )
}
