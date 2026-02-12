import { WebSocketEvent, Message, PresenceEvent, User } from '../types';

/**
 * VIRTUAL WEBSOCKET SERVICE (Simulation)
 * 
 * Uses both BroadcastChannel and LocalStorage to ensure messages sync across tabs
 * even in environments where one method might be restricted (e.g., sandboxed iframes).
 */

const CHANNEL_NAME = 'therasync-live-channel';
const STORAGE_KEY = 'therasync-event-bus';
const LATENCY_MS = 200;

type ListenerCallback = (data: any) => void;

class VirtualWebSocketService {
  private channel: BroadcastChannel;
  private isConnected: boolean = false;
  private userId: string | null = null;
  private instanceId: string;
  private messageQueue: WebSocketEvent[] = [];
  private pingInterval: any;
  private listeners: Map<string, Set<ListenerCallback>> = new Map();
  
  constructor() {
    this.instanceId = Math.random().toString(36).substr(2, 9);
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    
    // 1. Listen to BroadcastChannel (Primary)
    this.channel.onmessage = (event) => {
      this.handleIncomingData(event.data);
    };

    // 2. Listen to LocalStorage (Fallback/Redundancy)
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          // Ignore events from self
          if (data.meta?.instanceId !== this.instanceId) {
            this.handleIncomingData(data);
          }
        } catch (e) {
          console.error("Error parsing storage event", e);
        }
      }
    });
  }

  private handleIncomingData(data: WebSocketEvent & { meta?: { instanceId: string } }) {
    // INTERNAL HANDSHAKE LOGIC
    if (data.type === 'request_presence' && this.isConnected && this.userId) {
       // Add random jitter to prevent race conditions
       setTimeout(() => {
           this.broadcastEvent({
               type: 'presence',
               payload: { userId: this.userId!, status: 'online', timestamp: Date.now() }
           });
       }, 50 + Math.random() * 100);
       return;
    }

    // Pass normal events to the UI
    // We remove the artificial latency for incoming messages to make it feel snappier 
    // since we already have IPC overhead.
    this.emit(data.type, data.payload);
  }

  // --- Event Emitter Implementation ---
  public on(event: string, callback: ListenerCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  public off(event: string, callback: ListenerCallback): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  private emit(event: string, payload: any): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(callback => {
        try {
          callback(payload);
        } catch (e) {
          console.error(`Error in listener for ${event}:`, e);
        }
      });
    }
  }
  // ------------------------------------

  public connect(user: User): Promise<void> {
    return new Promise((resolve) => {
      console.log(`[WS] Connecting ${user.id}...`);
      
      // Simulate network delay
      setTimeout(() => {
        this.isConnected = true;
        this.userId = user.id;
        
        // 1. Announce I am here
        this.broadcastEvent({
          type: 'presence',
          payload: { userId: user.id, status: 'online', timestamp: Date.now() }
        });
        
        // 2. Ask "Who else is here?"
        this.broadcastEvent({
            type: 'request_presence',
            payload: null
        });
        
        this.startHeartbeat();
        this.flushQueue();
        
        resolve();
      }, LATENCY_MS);
    });
  }

  public disconnect(): void {
    if (this.userId) {
      this.broadcastEvent({
        type: 'presence',
        payload: { userId: this.userId, status: 'offline', timestamp: Date.now() }
      });
    }
    this.isConnected = false;
    this.userId = null;
    clearInterval(this.pingInterval);
    this.emit('close', {});
  }

  public sendMessage(message: Message): void {
    const event: WebSocketEvent = {
      type: 'message',
      payload: message
    };
    this.send(event);
  }

  public sendTyping(isTyping: boolean): void {
    if (!this.userId) return;
    const event: WebSocketEvent = {
      type: 'typing',
      payload: { userId: this.userId, isTyping }
    };
    this.send(event);
  }

  private send(event: WebSocketEvent) {
    if (!this.isConnected) {
      this.messageQueue.push(event);
      return;
    }
    this.broadcastEvent(event);
  }

  private broadcastEvent(baseEvent: WebSocketEvent) {
    const event = { 
      ...baseEvent, 
      meta: { instanceId: this.instanceId } 
    };

    // 1. Send via BroadcastChannel
    this.channel.postMessage(event);

    // 2. Send via LocalStorage (Trigger event in other tabs)
    // We set a unique key/value combo to ensure the 'storage' event fires
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(event));
      localStorage.removeItem(STORAGE_KEY); // Clean up immediately
    } catch (e) {
      console.warn("LocalStorage broadcast failed", e);
    }
  }

  private flushQueue() {
    while (this.messageQueue.length > 0) {
      const event = this.messageQueue.shift();
      if (event) this.broadcastEvent(event);
    }
  }

  public simulateNetworkDrop(): void {
    if (this.isConnected) {
        this.isConnected = false;
        clearInterval(this.pingInterval);
        this.emit('close', {});
    }
  }

  private startHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        const simulatedLatency = Math.floor(LATENCY_MS + Math.random() * 50);
        this.emit('latency', simulatedLatency);
      }
    }, 5000);
  }
}

export const socketService = new VirtualWebSocketService();