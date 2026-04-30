"use client";

import { useEffect, useState } from "react";

interface KlinePoint {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export function PriceChart({ pair }: { pair: string }) {
  const [klines, setKlines] = useState<KlinePoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pair) return;
    setLoading(true);
    const now = Math.floor(Date.now() / 1000);
    const from = now - 86400 * 7;
    fetch(`/api/klines?pair=${pair}&from=${from}&to=${now}`)
      .then((r) => r.json())
      .then((data) => {
        setKlines(Array.isArray(data) ? data : []);
      })
      .catch(() => setKlines([]))
      .finally(() => setLoading(false));
  }, [pair]);

  if (!pair) {
    return (
      <div className="w-full max-w-lg mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 p-6 text-center">
        <p className="text-zinc-500">Select a pair to view chart</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full max-w-lg mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 p-6 text-center">
        <p className="text-zinc-500">Loading chart data...</p>
      </div>
    );
  }

  if (klines.length === 0) {
    return (
      <div className="w-full max-w-lg mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
        <h3 className="text-sm font-medium text-white mb-4">Price Chart</h3>
        <div className="h-48 flex items-center justify-center text-zinc-600 text-sm">
          No historical data available yet. Swap events will populate this chart.
        </div>
      </div>
    );
  }

  const closes = klines.map((k) => parseFloat(k.close));
  const minClose = Math.min(...closes);
  const maxClose = Math.max(...closes);
  const range = maxClose - minClose || 1;
  const chartH = 180;
  const chartW = klines.length > 1 ? 100 / (klines.length - 1) : 100;

  const points = closes.map((c, i) => {
    const x = i * chartW;
    const y = chartH - ((c - minClose) / range) * (chartH - 20) - 10;
    return `${x},${y}`;
  }).join(" ");

  const lastClose = closes[closes.length - 1];
  const prevClose = closes.length > 1 ? closes[closes.length - 2] : lastClose;
  const change = prevClose > 0 ? ((lastClose - prevClose) / prevClose * 100).toFixed(2) : "0.00";
  const isUp = lastClose >= prevClose;

  return (
    <div className="w-full max-w-lg mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white">Price Chart</h3>
        <span className={`text-sm font-medium ${isUp ? "text-green-400" : "text-red-400"}`}>
          {isUp ? "+" : ""}{change}%
        </span>
      </div>
      <svg viewBox={`0 0 100 ${chartH}`} className="w-full" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={isUp ? "#4ade80" : "#f87171"}
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between mt-2 text-xs text-zinc-500">
        <span>{new Date(klines[0].openTime * 1000).toLocaleDateString()}</span>
        <span>{new Date(klines[klines.length - 1].openTime * 1000).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
