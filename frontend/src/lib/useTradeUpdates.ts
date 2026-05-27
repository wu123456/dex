"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface TradeUpdate {
  pair: string;
  price: string;
  amount0In: string;
  amount1In: string;
  amount0Out: string;
  amount1Out: string;
  to: string;
  txHash: string;
  blockNum: number;
  timestamp: number;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/api/ws";

export function useTradeUpdates(pair?: string) {
  const [lastTrade, setLastTrade] = useState<TradeUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setConnected(true);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "trade" && msg.data) {
          const trade = msg.data as TradeUpdate;
          if (!pair || trade.pair === pair) {
            setLastTrade(trade);
          }
        }
      } catch {}
    };
    ws.onclose = () => {
      setConnected(false);
      reconnectRef.current = setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();

    wsRef.current = ws;
  }, [pair]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { lastTrade, connected };
}
