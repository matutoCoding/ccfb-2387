import { For, Match, Show, Switch } from 'solid-js'
import type { ColorStop, GraphNode, ParamDef, RampStop } from '~/core/types'
import { NODE_DEFS } from '~/core/node_defs'
import { currentRecipe, mutateRecipe, touchRecipe, persistRecipe } from '~/core/store'
import { scheduleEvaluation, useEvaluation } from '~/core/evaluation'
import './parameter_panel.css'

function toHex(color: number[]): string {
  const h = (v: number): string => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')
  return `#${h(color[0])}${h(color[1])}${h(color[2])}`
}

function fromHex(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ]
}

function NumberParam(props: { node: GraphNode; def: ParamDef }) {
  const commit = (value: number) => {
    mutateRecipe((draft) => {
      draft.nodes.find((n) => n.id === props.node.id)!.params[props.def.key] = value
    })
    scheduleEvaluation(props.node.id)
  }
  // 滑块拖动过程不入历史，松手时落库并记录一步
  const liveDrag = (value: number) => {
    touchRecipe((draft) => {
      draft.nodes.find((n) => n.id === props.node.id)!.params[props.def.key] = value
    })
    scheduleEvaluation(props.node.id)
  }
  const value = () => props.node.params[props.def.key] as number
  return (
    <div class="param-row">
      <label>{props.def.label}</label>
      <div class="param-number">
        <input
          type="range"
          min={props.def.min}
          max={props.def.max}
          step={props.def.step}
          value={value()}
          onInput={(e) => liveDrag(Number(e.currentTarget.value))}
          onChange={(e) => commit(Number(e.currentTarget.value))}
          onMouseUp={persistRecipe}
        />
        <input
          type="number"
          min={props.def.min}
          max={props.def.max}
          step={props.def.step}
          value={value()}
          onChange={(e) => commit(Number(e.currentTarget.value))}
        />
      </div>
    </div>
  )
}

function ColorParam(props: { node: GraphNode; def: ParamDef }) {
  const color = () => props.node.params[props.def.key] as number[]
  return (
    <div class="param-row">
      <label>{props.def.label}</label>
      <input
        type="color"
        value={toHex(color())}
        onInput={(e) => {
          touchRecipe((draft) => {
            draft.nodes.find((n) => n.id === props.node.id)!.params[props.def.key] = fromHex(e.currentTarget.value)
          })
          scheduleEvaluation(props.node.id)
        }}
        onChange={(e) => {
          mutateRecipe((draft) => {
            draft.nodes.find((n) => n.id === props.node.id)!.params[props.def.key] = fromHex(e.currentTarget.value)
          })
          scheduleEvaluation(props.node.id)
        }}
      />
    </div>
  )
}

function GradientParam(props: { node: GraphNode; def: ParamDef }) {
  const stops = () => props.node.params[props.def.key] as ColorStop[]
  const update = (index: number, patch: Partial<ColorStop>) => {
    mutateRecipe((draft) => {
      const list = draft.nodes.find((n) => n.id === props.node.id)!.params[props.def.key] as ColorStop[]
      list[index] = { ...list[index], ...patch }
    })
    scheduleEvaluation(props.node.id)
  }
  const remove = (index: number) => {
    if (stops().length <= 2) return
    mutateRecipe((draft) => {
      const list = draft.nodes.find((n) => n.id === props.node.id)!.params[props.def.key] as ColorStop[]
      list.splice(index, 1)
    })
    scheduleEvaluation(props.node.id)
  }
  const gradientCss = () => {
    const parts = stops().map((s) => `${toHex(s.color)} ${Math.round(s.t * 100)}%`)
    return `linear-gradient(90deg, ${parts.join(', ')})`
  }
  return (
    <div class="param-row">
      <label>{props.def.label}</label>
      <div class="stop-bar" style={{ background: gradientCss() }} />
      <For each={stops()}>
        {(stop, i) => (
          <div class="stop-row">
            <input type="color" value={toHex(stop.color)} onInput={(e) => update(i(), { color: fromHex(e.currentTarget.value) })} />
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={stop.t}
              onChange={(e) => update(i(), { t: Number(e.currentTarget.value) })}
            />
            <button class="ghost danger" disabled={stops().length <= 2} onClick={() => remove(i())}>×</button>
          </div>
        )}
      </For>
      <button
        class="ghost"
        onClick={() => {
          mutateRecipe((draft) => {
            const list = draft.nodes.find((n) => n.id === props.node.id)!.params[props.def.key] as ColorStop[]
            list.push({ t: 1, color: [0.5, 0.5, 0.5] })
            list.sort((a, b) => a.t - b.t)
          })
          scheduleEvaluation(props.node.id)
        }}
      >
        添加色标
      </button>
    </div>
  )
}

function RampParam(props: { node: GraphNode; def: ParamDef }) {
  const stops = () => props.node.params[props.def.key] as RampStop[]
  const update = (index: number, patch: Partial<RampStop>) => {
    mutateRecipe((draft) => {
      const list = draft.nodes.find((n) => n.id === props.node.id)!.params[props.def.key] as RampStop[]
      list[index] = { ...list[index], ...patch }
    })
    scheduleEvaluation(props.node.id)
  }
  const remove = (index: number) => {
    if (stops().length <= 2) return
    mutateRecipe((draft) => {
      const list = draft.nodes.find((n) => n.id === props.node.id)!.params[props.def.key] as RampStop[]
      list.splice(index, 1)
    })
    scheduleEvaluation(props.node.id)
  }
  const points = () => stops().map((s) => `${s.t * 100},${(1 - s.value) * 100}`).join(' ')
  return (
    <div class="param-row">
      <label>{props.def.label}</label>
      <svg class="ramp-chart" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points={points()} fill="none" stroke="var(--copper-500)" stroke-width="2" vector-effect="non-scaling-stroke" />
      </svg>
      <For each={stops()}>
        {(stop, i) => (
          <div class="stop-row">
            <span class="muted">t</span>
            <input type="number" min={0} max={1} step={0.01} value={stop.t} onChange={(e) => update(i(), { t: Number(e.currentTarget.value) })} />
            <span class="muted">值</span>
            <input type="number" min={0} max={1} step={0.01} value={stop.value} onChange={(e) => update(i(), { value: Number(e.currentTarget.value) })} />
            <button class="ghost danger" disabled={stops().length <= 2} onClick={() => remove(i())}>×</button>
          </div>
        )}
      </For>
      <button
        class="ghost"
        onClick={() => {
          mutateRecipe((draft) => {
            const list = draft.nodes.find((n) => n.id === props.node.id)!.params[props.def.key] as RampStop[]
            list.push({ t: 1, value: 0.5 })
            list.sort((a, b) => a.t - b.t)
          })
          scheduleEvaluation(props.node.id)
        }}
      >
        添加控制点
      </button>
    </div>
  )
}

export default function ParameterPanel(props: { selectedId: string | null }) {
  const { report, evalMs } = useEvaluation()
  const node = () => currentRecipe().nodes.find((n) => n.id === props.selectedId) ?? null
  const def = () => (node() ? NODE_DEFS[node()!.type] : null)

  const timingOf = (id: string): string => {
    const ms = report()?.timings[id]
    return ms === undefined ? '-' : ms < 0.01 ? '<0.01ms' : `${ms.toFixed(2)}ms`
  }

  return (
    <aside class="parameter-panel card">
      <Show
        when={node()}
        fallback={
          <div class="empty-state">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 4v16M4 12h16" stroke-linecap="round" />
              </svg>
            </div>
            <h3>未选择节点</h3>
            <p>在画布中点击节点查看参数</p>
          </div>
        }
      >
        <div class="panel-header">
          <h2>{def()!.label}</h2>
          <span class="muted">{node()!.type}</span>
        </div>
        <div class="panel-body">
          <For each={def()!.params}>
            {(paramDef) => {
              const n = node()!
              return (
                <Switch param={paramDef}>
                  <Match when={paramDef.type === 'number'}>
                    <NumberParam node={n} def={paramDef} />
                  </Match>
                  <Match when={paramDef.type === 'select'}>
                    <div class="param-row">
                      <label>{paramDef.label}</label>
                      <select
                        value={n.params[paramDef.key] as string}
                        onChange={(e) => {
                          mutateRecipe((draft) => {
                            draft.nodes.find((x) => x.id === n.id)!.params[paramDef.key] = e.currentTarget.value
                          })
                          scheduleEvaluation(n.id)
                        }}
                      >
                        <For each={paramDef.options}>{(opt) => <option value={opt.value}>{opt.label}</option>}</For>
                      </select>
                    </div>
                  </Match>
                  <Match when={paramDef.type === 'color'}>
                    <ColorParam node={n} def={paramDef} />
                  </Match>
                  <Match when={paramDef.type === 'gradient'}>
                    <GradientParam node={n} def={paramDef} />
                  </Match>
                  <Match when={paramDef.type === 'ramp'}>
                    <RampParam node={n} def={paramDef} />
                  </Match>
                </Switch>
              )
            }}
          </For>
        </div>
        <div class="panel-footer">
          <div class="timing-row">
            <span class="muted">本节点耗时</span>
            <span>{timingOf(node()!.id)}</span>
          </div>
          <div class="timing-row">
            <span class="muted">全图重算</span>
            <span>{evalMs().toFixed(2)}ms</span>
          </div>
        </div>
      </Show>
    </aside>
  )
}
