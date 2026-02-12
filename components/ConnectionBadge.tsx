import React from 'react';
import { ConnectionStatus } from '../types';

interface Props {
  status: ConnectionStatus;
  latency?: number;
}

export const ConnectionBadge: React.FC<Props> = ({ status, latency }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-700 border-green-200';
      case 'connecting': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'reconnecting': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'disconnected': return 'bg-red-100 text-red-700 border-red-200';
    }
  };

  const getStatusDot = () => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-blue-500 animate-pulse';
      case 'reconnecting': return 'bg-amber-500 animate-pulse';
      case 'disconnected': return 'bg-red-500';
    }
  };

  const getLabel = () => {
    if (status === 'connected') return 'Live Sync Active';
    if (status === 'reconnecting') return 'Reconnecting...';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
      <span className={`w-2 h-2 rounded-full ${getStatusDot()}`} />
      <span>{getLabel()}</span>
      {status === 'connected' && latency !== undefined && (
        <span className="text-opacity-70 ml-1 border-l pl-2 border-current border-opacity-30">
          {latency}ms
        </span>
      )}
    </div>
  );
};
