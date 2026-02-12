import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Layout } from './components/Layout';
import { ConnectionBadge } from './components/ConnectionBadge';
import { ChatInterface } from './components/ChatInterface';
import { socketService } from './services/mockWebSocketService';
import { analyzeSessionSentiment } from './services/geminiService';
import { ConnectionStatus, Message, PresenceEvent, User, UserRole, WebSocketEvent } from './types';

// Utils
const generateId = () => Math.random().toString(36).substr(2, 9);

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [latency, setLatency] = useState<number>(0);

  // Connection management
  const connectSocket = useCallback(async (currentUser: User) => {
    try {
      setStatus('connecting');
      await socketService.connect(currentUser);
      setStatus('connected');
      setRetryCount(0);
    } catch (error) {
      console.error("Connection failed", error);
      setStatus('disconnected');
      // Simple retry logic simulation
      if (retryCount < 5) {
        setStatus('reconnecting');
        setTimeout(() => {
          setRetryCount(c => c + 1);
          connectSocket(currentUser);
        }, 2000 * (retryCount + 1));
      }
    }
  }, [retryCount]);

  useEffect(() => {
    if (!user) return;

    // Connect on mount (or user set)
    connectSocket(user);

    // Event Listeners (Updated for new Event Emitter pattern)
    // Note: We receive the payload directly now, not a CustomEvent
    const handleMessage = (message: Message) => {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      setIsOtherUserTyping(false);
    };

    const handlePresence = (presence: PresenceEvent) => {
      const { userId, status: userStatus } = presence;
      
      // Only react to others
      if (userId !== user.id) {
        const isOnline = userStatus === 'online';
        // Only trigger state update/notification if status actually changed
        setOtherUserOnline(prev => {
           if (prev === isOnline) return prev;
           
           // If status changed, add a system message
           const systemMsg: Message = {
            id: generateId(),
            senderId: 'system',
            senderName: 'System',
            senderRole: 'therapist', // irrelevant
            content: isOnline ? 'Other participant joined the session.' : 'Other participant left the session.',
            timestamp: Date.now(),
            type: 'system'
          };
          setMessages(m => [...m, systemMsg]);
          
          return isOnline;
        });
      }
    };
    
    const handleTyping = (data: {userId: string, isTyping: boolean}) => {
      if (data.userId !== user.id) {
        setIsOtherUserTyping(data.isTyping);
      }
    };

    const handleLatency = (ms: number) => {
      setLatency(ms);
    };

    const handleClose = () => {
      setStatus('disconnected');
      setOtherUserOnline(false);
      // Auto-reconnect trigger
      setStatus('reconnecting');
      setTimeout(() => connectSocket(user), 3000);
    };

    socketService.on('message', handleMessage);
    socketService.on('presence', handlePresence);
    socketService.on('typing', handleTyping);
    socketService.on('latency', handleLatency);
    socketService.on('close', handleClose);

    return () => {
      socketService.disconnect();
      socketService.off('message', handleMessage);
      socketService.off('presence', handlePresence);
      socketService.off('typing', handleTyping);
      socketService.off('latency', handleLatency);
      socketService.off('close', handleClose);
    };
  }, [user, connectSocket]);

  const handleSendMessage = (text: string) => {
    if (!user) return;
    
    const newMessage: Message = {
      id: generateId(),
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      content: text,
      timestamp: Date.now(),
      type: 'text'
    };

    // Optimistic update for local UI
    setMessages(prev => [...prev, newMessage]);
    
    // Send to other tabs via Service
    try {
      socketService.sendMessage(newMessage);
    } catch (e) {
      console.error("Failed to send", e);
    }
  };
  
  const handleTyping = (isTyping: boolean) => {
    socketService.sendTyping(isTyping);
  };

  const handleRoleSelect = (selectedRole: UserRole) => {
    // We use fixed IDs for the demo so Therapist and Patient always find each other in the "global" room
    const newUser: User = {
      id: selectedRole === 'therapist' ? 'th-123' : 'pt-456',
      name: selectedRole === 'therapist' ? 'Dr. Sarah' : 'Alex Client',
      role: selectedRole,
    };
    setUser(newUser);
    setRole(selectedRole);
  };

  const handleBack = () => {
    socketService.disconnect();
    setRole(null);
    setUser(null);
    setMessages([]);
    setStatus('disconnected');
    setOtherUserOnline(false);
    setIsOtherUserTyping(false);
    setAiAnalysis(null);
    setIsAnalyzing(false);
    setRetryCount(0);
    setLatency(0);
  };

  const triggerAnalysis = async () => {
    if (!messages.length) return;
    setIsAnalyzing(true);
    const result = await analyzeSessionSentiment(messages);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  // Simulate a connection drop
  const toggleConnection = () => {
    if (status === 'connected') {
      socketService.simulateNetworkDrop();
    } else if (status === 'disconnected') {
      if (user) connectSocket(user);
    }
  };

  const openNewSession = () => {
    // Use standard window.open to avoid "File not found" errors in restricted environments.
    // Opening without popup params behaves more like a standard link, which is safer.
    window.open(window.location.href, '_blank');
  };

  if (!role || !user) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8">
          <div className="text-center space-y-4 max-w-lg">
            <h2 className="text-3xl font-bold text-slate-800">Welcome to TheraSync Live</h2>
            <p className="text-slate-600">
              Select your role to join the secure session. 
              To test the chat, open a second session in a new window.
            </p>
            <button 
              onClick={openNewSession}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-medium transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Open Companion Session
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
            <button 
              onClick={() => handleRoleSelect('therapist')}
              className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-teal-500 hover:shadow-md transition-all group"
            >
              <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800">I am a Therapist</h3>
              <p className="text-sm text-slate-500 mt-2 text-center">Monitor patient status, view AI insights, and guide the session.</p>
            </button>

            <button 
              onClick={() => handleRoleSelect('patient')}
              className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-blue-500 hover:shadow-md transition-all group"
            >
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800">I am a Patient</h3>
              <p className="text-sm text-slate-500 mt-2 text-center">Join the secure session room to chat with your provider.</p>
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      onBack={handleBack}
      headerContent={
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end">
             <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Connection</span>
             <ConnectionBadge status={status} latency={status === 'connected' ? latency : undefined} />
          </div>
          <button 
            onClick={toggleConnection}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            {status === 'connected' ? 'Simulate Disconnect' : 'Force Connect'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Main Chat Area */}
        <div className="lg:col-span-2 space-y-4">
          <ChatInterface 
            messages={messages} 
            currentUser={user}
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            otherUserStatus={otherUserOnline ? 'online' : 'offline'}
            isOtherUserTyping={isOtherUserTyping}
            role={user.role}
          />
        </div>

        {/* Sidebar (Therapist Tools or Patient Info) */}
        <div className="space-y-6">
          {/* Info Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 uppercase tracking-wider">Session Details</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Duration</span>
                <span className="font-medium font-mono text-slate-700">14:20</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">Other Participant</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${otherUserOnline ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {otherUserOnline ? 'Connected' : 'Waiting...'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                 <span className="text-slate-500">Network Latency</span>
                 <span className={`font-medium ${latency > 300 ? 'text-amber-600' : 'text-slate-700'}`}>
                    {latency > 0 ? `${latency}ms` : 'Calculating...'}
                 </span>
              </div>
            </div>
          </div>

          {/* Therapist AI Tools */}
          {role === 'therapist' && (
            <div className="bg-gradient-to-br from-teal-50 to-white rounded-xl shadow-sm border border-teal-100 p-6">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-sm font-semibold text-teal-900 flex items-center gap-2">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                   </svg>
                   AI Assistant
                 </h3>
                 <button 
                  onClick={triggerAnalysis}
                  disabled={isAnalyzing || messages.length < 2}
                  className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded-md hover:bg-teal-700 disabled:opacity-50 transition-colors"
                 >
                   {isAnalyzing ? 'Analyzing...' : 'Analyze Now'}
                 </button>
               </div>
               
               {aiAnalysis ? (
                 <div className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-teal-50 shadow-sm animate-in fade-in duration-500">
                   {aiAnalysis}
                 </div>
               ) : (
                 <p className="text-sm text-slate-500 italic">
                   Accumulate messages to generate real-time sentiment analysis and therapeutic suggestions.
                 </p>
               )}
            </div>
          )}

          {/* Patient Tips */}
          {role === 'patient' && (
            <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-100 p-6">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Tips for this session</h3>
              <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside">
                <li>Be open and honest</li>
                <li>Take your time to type</li>
                <li>Your connection is encrypted</li>
                <li>Use the disconnect button to leave safely</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}