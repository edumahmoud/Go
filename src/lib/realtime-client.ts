'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

// Determine socket.io endpoint:
// - In production (Vercel): WebSocket service is disabled — return null to fall back to polling
// - On localhost dev server (port 3000): use direct port 3003
function getSocketUrl(): string | null {
  if (typeof window === 'undefined') return null
  // Production: no real-time WebSocket service available on Vercel
  if (process.env.NODE_ENV === 'production') return null

  const { hostname } = window.location
  // If we're on the dev server directly (localhost), talk to socket.io directly
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${hostname}:3003`
  }
  // Otherwise (preview via Caddy), use relative path with XTransformPort
  return ''
}

export function getRealtimeSocket(): Socket | null {
  if (typeof window === 'undefined') return null
  if (socket) return socket

  // Skip initialization entirely in production (Vercel) — use polling instead
  if (process.env.NODE_ENV === 'production') return null

  try {
    const url = getSocketUrl()
    if (url === null) return null

    const opts = {
      transports: ['websocket', 'polling'] as const,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
    }
    console.log('[realtime] connecting to socket.io at', url || '/?XTransformPort=3003')
    socket = url ? io(url, opts) : io('/?XTransformPort=3003', opts)
    socket.on('connect', () => {
      console.log('[realtime] connected, id:', socket?.id)
    })
    socket.on('connect_error', (err) => {
      console.warn('[realtime] connect_error:', err.message)
    })
    return socket
  } catch (e) {
    console.error('[realtime] Failed to init socket.io', e)
    return null
  }
}

export function isRealtimeAvailable(): boolean {
  return process.env.NODE_ENV !== 'production'
}

export function disconnectRealtime() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
