// 快照式撤销/重做，深拷贝隔离，上限 50 步
export class History<T> {
  private past: T[] = []
  private future: T[] = []
  private capacity = 50

  // 记录一次变更前的状态
  commit(previous: T): void {
    this.past.push(structuredClone(previous))
    if (this.past.length > this.capacity) this.past.shift()
    this.future = []
  }

  undo(current: T): T | null {
    const prev = this.past.pop()
    if (prev === undefined) return null
    this.future.push(structuredClone(current))
    return prev
  }

  redo(current: T): T | null {
    const next = this.future.pop()
    if (next === undefined) return null
    this.past.push(structuredClone(current))
    return next
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  clear(): void {
    this.past = []
    this.future = []
  }
}
