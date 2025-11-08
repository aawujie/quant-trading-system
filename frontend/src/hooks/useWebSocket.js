import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * WebSocket Hook for real-time data streaming
 * 
 * @param {string} url - WebSocket server URL
 * @param {function} onMessage - Message handler function
 * @returns {object} - { isConnected, subscribe, unsubscribe }
 */
export function useWebSocket(url, onMessage) {
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);
  const subscribedTopicsRef = useRef(new Set());

  useEffect(() => {
    let shouldReconnect = true;

    const connect = () => {
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);

          // Resubscribe to topics after reconnection
          if (subscribedTopicsRef.current.size > 0) {
            ws.send(JSON.stringify({
              action: 'subscribe',
              topics: Array.from(subscribedTopicsRef.current)
            }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (onMessage) {
              onMessage(message);
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setIsConnected(false);

          // Auto-reconnect after 3 seconds
          if (shouldReconnect) {
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('Attempting to reconnect...');
              connect();
            }, 3000);
          }
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
      }
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url]);

  const subscribe = useCallback((topics) => {
    if (!Array.isArray(topics)) {
      topics = [topics];
    }

    topics.forEach(topic => subscribedTopicsRef.current.add(topic));

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'subscribe',
        topics: topics
      }));
    }
  }, []);

  const unsubscribe = useCallback((topics) => {
    if (!Array.isArray(topics)) {
      topics = [topics];
    }

    topics.forEach(topic => subscribedTopicsRef.current.delete(topic));

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'unsubscribe',
        topics: topics
      }));
    }
  }, []);

  return { isConnected, subscribe, unsubscribe };
}

