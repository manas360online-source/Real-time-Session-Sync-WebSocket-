/**
 * REAL WEBSOCKET SERVER IMPLEMENTATION
 * Requirements:
 * - WebSocket Server: ws
 * - Pub/Sub: redis
 * - Resilience: Heartbeats, Auto-reconnect support (client-side driven)
 * - Scalability: 100+ concurrent sessions
 */

const WebSocket = require('ws');
const { createClient } = require('redis');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Redis Clients for Pub/Sub
const subscriber = createClient();
const publisher = createClient();

(async () => {
    try {
        await subscriber.connect();
        await publisher.connect();
        console.log("Redis connected");
    } catch (err) {
        console.error("Redis connection error:", err);
    }
})();

// Store active connections: Map<UserId, WebSocket>
const clients = new Map();

// Channel for broadcasting messages across server instances
const REDIS_CHANNEL = 'therasync-global';

// Message Queue for disconnected clients (Simplified In-Memory for Demo)
// In production, use Redis Lists or a persistent DB
const offlineQueue = new Map(); // Map<UserId, Message[]>

// Handle Redis messages (from other server instances or this one)
subscriber.subscribe(REDIS_CHANNEL, (message) => {
  const event = JSON.parse(message);
  
  // Logic to determine recipients. For this global channel, we broadcast to all local.
  // In a real app, you'd filter by sessionId or roomId.
  
  if (event.type === 'message' || event.type === 'presence' || event.type === 'typing') {
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          // If this message is intended for a specific user (e.g. 1:1 chat), check logic here.
          // For this demo, we broadcast to everyone (room model).
          client.send(message);
        }
      });
  }
});

function heartbeat() {
  this.isAlive = true;
}

wss.on('connection', (ws, req) => {
  const userId = new URL(req.url, `http://${req.headers.host}`).searchParams.get('userId');
  const role = new URL(req.url, `http://${req.headers.host}`).searchParams.get('role');
  
  if (!userId) {
    ws.close();
    return;
  }

  ws.isAlive = true;
  ws.on('pong', heartbeat);

  console.log(`Client connected: ${userId} (${role})`);
  clients.set(userId, ws);

  // 1. Check Offline Queue and deliver missed messages
  if (offlineQueue.has(userId)) {
      const missedMessages = offlineQueue.get(userId);
      console.log(`Delivering ${missedMessages.length} queued messages to ${userId}`);
      missedMessages.forEach(msg => ws.send(JSON.stringify(msg)));
      offlineQueue.delete(userId);
  }

  // 2. Broadcast Presence: Online
  const presenceEvent = {
    type: 'presence',
    payload: {
      userId,
      status: 'online',
      timestamp: Date.now()
    }
  };
  publisher.publish(REDIS_CHANNEL, JSON.stringify(presenceEvent));

  ws.on('message', (data) => {
    try {
      const parsedData = JSON.parse(data);
      
      // Heartbeat / Latency check
      if (parsedData.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          return;
      }

      // 3. Handle Message Broadcasting
      publisher.publish(REDIS_CHANNEL, JSON.stringify(parsedData));
      
    } catch (e) {
      console.error('Failed to parse message', e);
    }
  });

  ws.on('close', () => {
    console.log(`Client disconnected: ${userId}`);
    clients.delete(userId);

    // 4. Broadcast Presence: Offline
    const offlineEvent = {
      type: 'presence',
      payload: {
        userId,
        status: 'offline',
        timestamp: Date.now()
      }
    };
    publisher.publish(REDIS_CHANNEL, JSON.stringify(offlineEvent));
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for ${userId}:`, error);
  });

  // Initial State
  ws.send(JSON.stringify({
    type: 'system',
    payload: { content: 'Connected to TheraSync Secure Server' }
  }));
});

// Interval to check for broken connections (30s)
const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', function close() {
  clearInterval(interval);
});

console.log(`TheraSync WebSocket Server running on port ${PORT}`);
