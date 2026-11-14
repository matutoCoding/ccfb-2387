import * as THREE from 'three'

// 程序生成铜把手：弯管 + 两个安装座，全部依赖种子做确定性扰动
export function createCopperHandle(seed: number): THREE.Group {
  const group = new THREE.Group()
  let state = seed >>> 0
  const rand = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0
    return (state >>> 0) / 4294967296
  }

  // U 形弯管路径
  const points: THREE.Vector3[] = []
  const halfWidth = 0.9
  const height = 1.5
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    points.push(new THREE.Vector3(-halfWidth, -height / 2 + t * height, 0))
  }
  const curve = new THREE.CatmullRomCurve3(points)
  const tubeGeo = new THREE.TubeGeometry(curve, 96, 0.14, 24, false)
  // 轻微半径扰动，模拟旧件磨损
  const pos = tubeGeo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i)
    const wobble = 1 + (rand() - 0.5) * 0.03
    v.multiplyScalar(wobble)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  tubeGeo.computeVertexNormals()
  const tube = new THREE.Mesh(tubeGeo, new THREE.MeshStandardMaterial())
  tube.name = 'handle-tube'
  group.add(tube)

  // 两端安装座：短柱 + 圆盘
  for (const side of [-1, 1]) {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 0.36, 20),
      new THREE.MeshStandardMaterial(),
    )
    stem.position.set(side * halfWidth, height / 2 + 0.14, 0)
    stem.name = 'handle-stem'

    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.32, 0.1, 28),
      new THREE.MeshStandardMaterial(),
    )
    plate.position.set(side * halfWidth, height / 2 + 0.36, 0)
    plate.name = 'handle-plate'

    group.add(stem, plate)
  }

  // 背板，提供接地阴影与场景参照
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 3.6, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.85, metalness: 0.1 }),
  )
  back.position.z = -0.34
  back.name = 'backplate'
  group.add(back)

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.name !== 'backplate') {
      obj.castShadow = true
      obj.receiveShadow = true
    }
  })
  return group
}

// TubeGeometry 的 UV 在 u=0/1 处接缝，提取接缝世界坐标供定位线使用
export function collectSeamPoints(mesh: THREE.Mesh): THREE.Vector3[] {
  const geo = mesh.geometry as THREE.TubeGeometry
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const points: THREE.Vector3[] = []
  const v = new THREE.Vector3()
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i)
    if (u < 0.02 || u > 0.98) {
      v.fromBufferAttribute(geo.attributes.position as THREE.BufferAttribute, i)
      points.push(v.clone().applyMatrix4(mesh.matrixWorld))
    }
  }
  return points
}
