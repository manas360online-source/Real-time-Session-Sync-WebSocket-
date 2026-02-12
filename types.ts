export type UserRole = 'therapist' | 'patient';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  isOnline?: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  timestamp: number;
  type: 'text' | 'system' | 'analysis';
}

export interface PresenceEvent {
  userId: string;
  status: 'online' | 'offline';
  timestamp: number;
}

export interface WebSocketEvent {
  type: 'message' | 'presence' | 'typing' | 'latency' | 'request_presence';
  payload: any;
}
