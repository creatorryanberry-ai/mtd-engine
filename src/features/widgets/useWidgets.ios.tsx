import { useEffect } from 'react'

import { initCreatePostWidget } from './widgets'

export function useWidgets() {
  useEffect(() => {
    initCreatePostWidget()
  }, [])
}
