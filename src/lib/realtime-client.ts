'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

// Determine socket.io endpoint:
// - In production / preview: relative path with XTransformPort=3003 (Caddy forwards)
// - When accessing dev server directly (localhost:3000): use direct port 3003
function getSocketUrl(): string {
  if (typeof window === 'undefined') return ''
  const { hostname, port } = window.location
  // If we're on the dev server directly (port 3000), talk to socket.io directly
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${hostname}:3003`
  }
  // Otherwise (production / preview via Caddy), use relative path with XTransformPort
  return ''
}

export function getRealtimeSocket(): Socket | null {
  if (typeof window === 'undefined') return null
  if (socket) return socket

  try {
    const url = getSocketUrl()
    const path = url ? '/' : '/'
    const opts = url
      ? { transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 10 }
      : { path, transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 10 }
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

export function disconnectRealtime() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
