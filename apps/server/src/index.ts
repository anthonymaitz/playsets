import { createServer } from 'http'
import { Server } from 'socket.io'
import { RoomRegistry } from './rooms.js'

function isCallback(fn: unknown): fn is (...args: unknown[]) => void {
  return typeof fn === 'function'
}

const rawPort = parseInt(process.env.PORT ?? '', 10)
const PORT = Number.isNaN(rawPort) ? 3001 : rawPort
const registry = new RoomRegistry()
const http = createServer()
const io = new Server(http, {
  cors: { origin: '*' },
})

io.on('connection', (socket) => {
  socket.on('create-room', (cb: unknown) => {
    if (!isCallback(cb)) return
    const entry = registry.create(socket.id)
    socket.join(entry.roomId)
    cb({ roomId: entry.roomId })
  })

  socket.on('join-room', (roomId: string, cb: unknown) => {
    if (!isCallback(cb)) return
    const result = registry.addGuest(roomId, socket.id)
    if (result === 'not-found') { cb({ error: 'room-not-found' }); return }
    if (result === 'full') { cb({ error: 'room-full' }); return }
    socket.join(roomId)
    const entry = registry.get(roomId)!
    socket.to(entry.hostSocketId).emit('guest-joined', socket.id)
    cb({})
  })

  socket.on('offer', (payload: { to: string; offer: object }) => {
    io.to(payload.to).emit('offer', { from: socket.id, offer: payload.offer })
  })

  socket.on('answer', (payload: { to: string; answer: object }) => {
    io.to(payload.to).emit('answer', { from: socket.id, answer: payload.answer })
  })

  socket.on('ice-candidate', (payload: { to: string; candidate: object }) => {
    io.to(payload.to).emit('ice-candidate', { from: socket.id, candidate: payload.candidate })
  })

  socket.on('disconnect', () => {
    const entry = registry.findRoomBySocket(socket.id)
    if (entry) {
      if (entry.hostSocketId === socket.id) {
        socket.to(entry.roomId).emit('host-disconnected')
      } else {
        socket.to(entry.hostSocketId).emit('guest-left', socket.id)
      }
    }
    registry.removeSocket(socket.id)
  })
})

http.listen(PORT, () => console.log(`Signaling server listening on :${PORT}`))
