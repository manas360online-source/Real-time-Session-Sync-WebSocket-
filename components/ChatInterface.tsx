import React, { useEffect, useRef } from 'react';
import { Message, User, UserRole } from '../types';

interface Props {
  messages: Message[];
  currentUser: User;
  onSendMessage: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
  otherUserStatus: 'online' | 'offline';
  isOtherUserTyping: boolean;
  role: UserRole;
}

export const ChatInterface: React.FC<Props> = ({ 
  messages, 
  currentUser, 
  onSendMessage, 
  onTyping,
  otherUserStatus,
  isOtherUserTyping,
  role
}) => {
  const [inputText, setInputText] = React.useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOtherUserTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    
    // Debounce typing indicator
    onTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 1500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
      onTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const isTherapist = role === 'therapist';

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Chat Header */}
      <div className={`px-4 py-3 border-b border-slate-100 flex justify-between items-center ${isTherapist ? 'bg-teal-50' : 'bg-blue-50'}`}>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">
            {isTherapist ? 'Patient Session' : 'Dr. Sarah Mitchell'}
          </h2>
          <p className="text-xs text-slate-500">
            {isTherapist ? 'Session ID: #8821A' : 'Licensed Clinical Psychologist'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${otherUserStatus === 'online' ? 'bg-green-500' : 'bg-slate-300'}`}></span>
          <span className="text-slate-600">{otherUserStatus === 'online' ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
            <p>Session started. Waiting for messages...</p>
            <p className="text-xs opacity-75 mt-1">Messages are end-to-end encrypted.</p>
          </div>
        )}
        
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;
          const isSystem = msg.type === 'system';
          
          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-2">
                <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-full">
                  {msg.content}
                </span>
              </div>
            );
          }

          return (
            <div 
              key={msg.id} 
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                isMe 
                  ? (isTherapist ? 'bg-teal-600 text-white rounded-br-none' : 'bg-blue-600 text-white rounded-br-none') 
                  : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
              }`}>
                <p>{msg.content}</p>
                <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-white/80' : 'text-slate-400'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Typing Indicator */}
        {isOtherUserTyping && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex gap-1 items-center">
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder={isTherapist ? "Type guidance..." : "Type your response..."}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className={`px-4 py-2 rounded-lg text-white font-medium text-sm transition-colors ${
              !inputText.trim() 
                ? 'bg-slate-300 cursor-not-allowed' 
                : (isTherapist ? 'bg-teal-600 hover:bg-teal-700' : 'bg-blue-600 hover:bg-blue-700')
            }`}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
