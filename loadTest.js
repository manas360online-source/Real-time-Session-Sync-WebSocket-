/**
 * LOAD TEST SCRIPT
 * 
 * IMPORTANT: This script is for Node.js environments only.
 * DO NOT RUN THIS IN THE BROWSER CONSOLE.
 * 
 * Usage:
 * 1. Open your Terminal (Command Prompt / Shell)
 * 2. Run: node server.js
 * 3. Open a second Terminal window
 * 4. Run: node loadTest.js
 * 
 * Requirements: npm install ws
 */

// Safe require for environments where 'require' might not be defined immediately
let WebSocket;
try {
  WebSocket = require('ws');
} catch (e) {
  console.error("WebSocket module 'ws' not found. Please run 'npm install ws' in your terminal.");
  process.exit(1);
}

const SESSION_COUNT = 100;
const SERVER_URL = 'ws://localhost:8080';
const clients = [];

console.log(`Starting load test with ${SESSION_COUNT} sessions...`);

let connectedCount = 0;

for (let i = 0; i < SESSION_COUNT; i++) {
    const userId = `load-user-${i}`;
    const role = i % 2 === 0 ? 'therapist' : 'patient';
    const ws = new WebSocket(`${SERVER_URL}?userId=${userId}&role=${role}`);

    ws.on('open', () => {
        connectedCount++;
        if (connectedCount === SESSION_COUNT) {
            console.log(`✓ All ${SESSION_COUNT} clients connected successfully.`);
            startMessaging();
        }
    });

    ws.on('error', (err) => {
        // Suppress initial connection errors to keep output clean if server isn't running
    });
    
    clients.push(ws);
}

function startMessaging() {
    console.log("Starting message broadcast simulation...");
    let messageCount = 0;
    
    const interval = setInterval(() => {
        // Randomly pick a client to send a message
        const senderIndex = Math.floor(Math.random() * SESSION_COUNT);
        const ws = clients[senderIndex];
        
        if (ws.readyState === WebSocket.OPEN) {
            const msg = {
                type: 'message',
                senderId: `load-user-${senderIndex}`,
                content: `Load test message ${messageCount++} at ${Date.now()}`,
                timestamp: Date.now()
            };
            ws.send(JSON.stringify(msg));
        }
        
        if (messageCount >= 1000) {
            console.log("✓ Sent 1000 messages. Stopping test.");
            clearInterval(interval);
            cleanup();
        }
    }, 50); // Send every 50ms
}

function cleanup() {
    clients.forEach(ws => ws.close());
    console.log("Test complete.");
    process.exit(0);
}