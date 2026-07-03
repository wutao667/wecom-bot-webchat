import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// Module-level singleton
let globalSocket = null;

function createSocket() {
  if (globalSocket?.connected) return globalSocket;

  const token = localStorage.getItem('token');
  if (!token) return null;

  if (globalSocket) {
    globalSocket.disconnect();
  }

  const socketUrl = window.location.origin;
  globalSocket = io(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  globalSocket.on('connect', () => {
    console.log('[socket] Connected:', globalSocket.id);
  });

  globalSocket.on('connect_error', (err) => {
    console.error('[socket] Connection error:', err.message);
  });

  globalSocket.on('disconnect', (reason) => {
    console.log('[socket] Disconnected:', reason);
  });

  return globalSocket;
}

/**
 * Hook that provides a socket.io connection, shared across components.
 * Returns the socket instance. Manages lifecycle with ref counting.
 */
export function useSocket() {
  const [, forceUpdate] = useState(0);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    // Force re-render once connected (so listeners can attach)
    if (socket) {
      const onConnect = () => forceUpdate((n) => n + 1);
      socket.on('connect', onConnect);
      forceUpdate((n) => n + 1);
    }

    return () => {
      if (socket) {
        socket.off('connect');
      }
      // Don't disconnect - singleton is shared
    };
  }, []);

  return socketRef.current || globalSocket;
}

/**
 * Get the current socket instance outside of React components.
 */
export function getSocket() {
  return globalSocket;
}

/**
 * Initialize/reinitialize the socket connection.
 */
export function initSocket() {
  return createSocket();
}
