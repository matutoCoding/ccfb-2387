import type { NodeDef } from './types'

// 全部节点为纯数据定义，求值逻辑在 engine.ts 中按 type 分派
export const NODE_DEFS: Record<string, NodeDef> = {
  texcoord: {
    type: 'texcoord',
    label: 'UV 坐标',
    category: '输入',
    inputs: [],
    outputs: [{ id: 'uv', label: 'UV', type: 'vec2' }],
    params: [],
  },
  value_noise: {
    type: 'value_noise',
    label: '值噪声',
    category: '噪声',
    inputs: [{ id: 'uv', label: 'UV', type: 'vec2', fallback: [0, 0] }],
    outputs: [{ id: 'value', label: '值', type: 'float' }],
    params: [
      { key: 'scale', label: '噪声缩放', type: 'number', default: 8, min: 0.5, max: 64, step: 0.5 },
      { key: 'seedOffset', label: '种子偏移', type: 'number', default: 0, min: 0, max: 9999, step: 1 },
    ],
  },
  fbm_noise: {
    type: 'fbm_noise',
    label: '分形噪声 FBM',
    category: '噪声',
    inputs: [{ id: 'uv', label: 'UV', type: 'vec2', fallback: [0, 0] }],
    outputs: [{ id: 'value', label: '值', type: 'float' }],
    params: [
      { key: 'scale', label: '噪声缩放', type: 'number', default: 6, min: 0.5, max: 64, step: 0.5 },
      { key: 'octaves', label: '八度', type: 'number', default: 4, min: 1, max: 8, step: 1 },
      { key: 'seedOffset', label: '种子偏移', type: 'number', default: 0, min: 0, max: 9999, step: 1 },
    ],
  },
  curvature: {
    type: 'curvature',
    label: '曲率遮罩',
    category: '遮罩',
    inputs: [{ id: 'height', label: '高度', type: 'float', fallback: [0.5] }],
    outputs: [{ id: 'mask', label: '遮罩', type: 'float' }],
    params: [
      {
        key: 'mode', label: '模式', type: 'select', default: 'both',
        options: [
          { label: '边缘+凹缝', value: 'both' },
          { label: '仅边缘', value: 'edges' },
          { label: '仅凹缝', value: 'cavities' },
          { label: '反相', value: 'inverted' },
        ],
      },
      { key: 'radius', label: '采样半径', type: 'number', default: 1.5, min: 0.5, max: 8, step: 0.5 },
    ],
  },
  grime: {
    type: 'grime',
    label: '污渍混合',
    category: '混合',
    inputs: [
      { id: 'base', label: '底色', type: 'vec3', fallback: [0.3, 0.2, 0.12] },
      { id: 'stain', label: '污渍色', type: 'vec3', fallback: [0.12, 0.28, 0.2] },
      { id: 'mask', label: '遮罩', type: 'float', fallback: [0] },
    ],
    outputs: [{ id: 'color', label: '颜色', type: 'vec3' }],
    params: [
      { key: 'threshold', label: '阈值', type: 'number', default: 0.45, min: 0, max: 1, step: 0.01 },
      { key: 'softness', label: '柔化', type: 'number', default: 0.2, min: 0.01, max: 1, step: 0.01 },
      { key: 'strength', label: '强度', type: 'number', default: 0.7, min: 0, max: 1, step: 0.01 },
    ],
  },
  gradient_map: {
    type: 'gradient_map',
    label: '颜色渐变',
    category: '映射',
    inputs: [{ id: 'value', label: '输入值', type: 'float', fallback: [0.5] }],
    outputs: [{ id: 'color', label: '颜色', type: 'vec3' }],
    params: [
      {
        key: 'gradient', label: '渐变', type: 'gradient',
        default: [
          { t: 0, color: [0.11, 0.24, 0.18] },
          { t: 0.55, color: [0.45, 0.29, 0.16] },
          { t: 1, color: [0.78, 0.53, 0.28] },
        ],
      },
    ],
  },
  ramp_map: {
    type: 'ramp_map',
    label: '数值曲线',
    category: '映射',
    inputs: [{ id: 'value', label: '输入值', type: 'float', fallback: [0.5] }],
    outputs: [{ id: 'value', label: '值', type: 'float' }],
    params: [
      {
        key: 'ramp', label: '曲线', type: 'ramp',
        default: [
          { t: 0, value: 0.9 },
          { t: 0.5, value: 0.55 },
          { t: 1, value: 0.25 },
        ],
      },
    ],
  },
  constant_color: {
    type: 'constant_color',
    label: '常量颜色',
    category: '输入',
    inputs: [],
    outputs: [{ id: 'color', label: '颜色', type: 'vec3' }],
    params: [{ key: 'color', label: '颜色', type: 'color', default: [0.12, 0.28, 0.2] }],
  },
  output: {
    type: 'output',
    label: '材质输出',
    category: '输出',
    inputs: [
      { id: 'baseColor', label: '基础色', type: 'vec3', fallback: [0.35, 0.22, 0.12] },
      { id: 'roughness', label: '粗糙度', type: 'float', fallback: [0.55] },
      { id: 'metallic', label: '金属度', type: 'float', fallback: [0.9] },
      { id: 'height', label: '高度', type: 'float', fallback: [0.5] },
    ],
    outputs: [],
    params: [
      { key: 'normalStrength', label: '法线强度', type: 'number', default: 1.5, min: 0, max: 5, step: 0.1 },
    ],
  },
}

export function defOf(type: string): NodeDef {
  const def = NODE_DEFS[type]
  if (!def) throw new Error(`未知节点类型: ${type}`)
  return def
}
