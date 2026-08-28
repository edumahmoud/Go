// Internal broadcast helper.
// Sends real-time events to the WebSocket service when available.
// In production (Vercel), REALTIME_BROADCAST_URL is empty and this is a no-op
// — the client UI falls back to polling instead.

const BROADCAST_URL = process.env.REALTIME_BROADCAST_URL || ''

export async function broadcastEvent(event: string, payload: unknown): Promise<void> {
  if (!BROADCAST_URL) return // no-op in production
  try {
    await fetch(`${BROADCAST_URL}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, payload }),
      // Don't let a slow broadcast hang the API response
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    // WebSocket service may be down; ignore silently
  }
}
