/// <reference types="vite/client" />

import type { PortalConfig } from './types'

declare global {
  interface Window {
    config?: PortalConfig
  }
}

export {}
