import { createServer, IncomingMessage } from 'http'
import { Server, Socket } from 'socket.io'

// Real-time service for attendance tracking app.
// Two listeners:
//   - Port 3003: socket.io for browser dashboard clients
//   - Port 3004: internal HTTP for the Next.js API to push broadcasts (POST /broadcast)

// Internal HTTP listener (no socket.io interference)
const broadcastServer = createServer(async (req: IncomingMessage, res) => {
  if (req.method === 'POST' && req.url?.startsWith('/broadcast')) {
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      const msg = JSON.parse(body)
      const { event, payload } = msg as { event: string; payload: unknown }
      if (event) {
        io.emit(event, payload)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, broadcast: true, clients: io.engine.clientsCount }))
        return
      }
    } catch (e) {
      console.error('Failed to parse broadcast body:', e)
    }
    res.writeHead(400)
    res.end('Bad Request')
    return
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, connections: io.engine.clientsCount }))
    return
  }
  res.writeHead(404)
  res.end('Not Found')
})

const io = new Server(
  {
    // socket.io attaches its own listeners
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 60000,
    pingInterval: 25000,
  },
)

const managerSockets = new Set<Socket>()

io.on('connection', (socket) => {
  socket.on('identify', (payload: { role?: string }) => {
    if (payload?.role === 'MANAGER' || payload?.role === 'SUPERVISOR') {
      managerSockets.add(socket)
      socket.join('managers')
    }
    socket.emit('identified', { ok: true })
  })

  socket.on('subscribe:locations', () => {
    socket.join('locations')
  })

  socket.on('unsubscribe:locations', () => {
    socket.leave('locations')
  })

  socket.on('disconnect', () => {
    managerSockets.delete(socket)
  })

  socket.on('error', (err) => {
    console.error('socket error:', err)
  })
})

const SOCKET_PORT = 3003
const BROADCAST_PORT = 3004

// Attach socket.io to its own HTTP server
const socketHttpServer = createServer()
io.attach(socketHttpServer, { path: '/', cors: { origin: '*', methods: ['GET', 'POST'] } })

socketHttpServer.listen(SOCKET_PORT, '127.0.0.1', () => {
  console.log(`[realtime-service] socket.io listening on 127.0.0.1:${SOCKET_PORT}`)
})

broadcastServer.listen(BROADCAST_PORT, '127.0.0.1', () => {
  console.log(`[realtime-service] broadcast HTTP listening on 127.0.0.1:${BROADCAST_PORT}`)
})

process.on('SIGTERM', () => {
  broadcastServer.close(() => process.exit(0))
  socketHttpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  broadcastServer.close(() => process.exit(0))
  socketHttpServer.close(() => process.exit(0))
})
