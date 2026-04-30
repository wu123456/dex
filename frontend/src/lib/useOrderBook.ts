"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface OrderBookUpdate {
  tokenIn: string;
  tokenOut: string;
  bids: PriceLevel[];
  asks: PriceLevel[];
}

export interface PriceLevel {
  price: string;
  amount: string;
  count: number;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/api/ws";

export function useOrderBook(tokenIn?: string, tokenOut?: string) {
  const [orderBook, setOrderBook] = useState<OrderBookUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "orderbook" && msg.data) {
          const data = msg.data as OrderBookUpdate;
          if (
            tokenIn &&
            tokenOut &&
            data.tokenIn === tokenIn &&
            data.tokenOut === tokenOut
          ) {
            setOrderBook(data);
          } else if (!tokenIn || !tokenOut) {
            setOrderBook(data);
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [tokenIn, tokenOut]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { orderBook, connected };
}

export function useFetchOrderBook(tokenIn?: string, tokenOut?: string) {
  const [orderBook, setOrderBook] = useState<OrderBookUpdate | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchOrderBook = useCallback(async () => {
    if (!tokenIn || !tokenOut) return;
    setLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      const res = await fetch(
        `${apiBase}/api/orderbook?tokenIn=${tokenIn}&tokenOut=${tokenOut}`
      );
      if (res.ok) {
        const data = await res.json();
        setOrderBook(data);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [tokenIn, tokenOut]);

  useEffect(() => {
    fetchOrderBook();
    const interval = setInterval(fetchOrderBook, 5000);
    return () => clearInterval(interval);
  }, [fetchOrderBook]);

  return { orderBook, loading, refetch: fetchOrderBook };
}
