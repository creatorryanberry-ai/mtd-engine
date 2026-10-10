type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  clear: () => void
}

export function createWriteEpochStorage<T extends StorageLike>(inner: T) {
  let writeEpoch = 0

  return {
    invalidate() {
      writeEpoch += 1
      inner.clear()
    },
    fork() {
      const epoch = writeEpoch
      return {
        getItem: (key: string) => inner.getItem(key),
        setItem: (key: string, value: string) => {
          if (epoch !== writeEpoch) return
          inner.setItem(key, value)
        },
        clear: () => inner.clear(),
      }
    },
  }
}
