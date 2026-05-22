import { useEffect, useRef } from "react";
import { createChart, ColorType, IChartApi } from "lightweight-charts";
import type { TokenRow } from "../../types";

interface Props {
  token: TokenRow;
  onClose: () => void;
}

export default function TokenDetailModal({ token, onClose }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartRef.current || !token.ohlcv.length) return;

    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#151518" },
        textColor: "#888",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#2a2a2e" },
        horzLines: { color: "#2a2a2e" },
      },
      width: chartRef.current.clientWidth,
      height: 400,
      crosshair: {
        mode: 0,
      },
      timeScale: {
        borderColor: "#2a2a2e",
      },
      rightPriceScale: {
        borderColor: "#2a2a2e",
      },
    });

    chartInstance.current = chart;

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      wickUpColor: "#22c55e",
    });

    const candleData = token.ohlcv.map((c, i) => ({
      time: i as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(candleData);

    // Volume series
    const volSeries = chart.addHistogramSeries({
      color: "#3b82f680",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    const volData = token.ohlcv.map((c, i) => ({
      time: i as any,
      value: c.volume,
      color: c.close >= c.open ? "#22c55e40" : "#ef444440",
    }));
    volSeries.setData(volData);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartRef.current) {
        chart.applyOptions({ width: chartRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [token]);

  // Handle resize via ResizeObserver too
  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      chartInstance.current?.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scoreBars = [
    { label: "Alpha", value: token.alpha, color: "bg-signal-yellow" },
    { label: "Smart Money", value: token.smartMoney, color: "bg-signal-blue" },
    { label: "Swing", value: token.swing, color: "bg-signal-orange" },
    { label: "Accumulation", value: token.accumulation, color: "bg-purple-500" },
    { label: "Consensus", value: token.consensus, color: "bg-signal-green" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="flex flex-col bg-surface-card border border-border rounded-lg w-[800px] max-w-[95vw] max-h-[90vh] overflow-auto scroll-thin"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <span className="text-heading text-text-primary font-semibold">
              {token.symbol.replace("USDT", "")}
              <span className="text-text-muted font-normal">/USDT</span>
            </span>
            <span className="ml-3 text-body text-text-primary tabular-nums">
              ${token.price < 0.01 ? token.price.toFixed(6) : token.price.toFixed(4)}
            </span>
            <span className={`ml-2 text-label tabular-nums ${token.priceChange24h >= 0 ? "text-signal-green" : "text-signal-red"}`}>
              {token.priceChange24h >= 0 ? "+" : ""}{token.priceChange24h.toFixed(2)}%
            </span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl leading-none">&times;</button>
        </div>

        <div className="flex flex-1 flex-col lg:flex-row">
          {/* Chart */}
          <div className="flex-1 p-3 min-w-0">
            <div ref={chartRef} className="w-full rounded" style={{ height: 400 }} />
          </div>

          {/* Scores sidebar */}
          <div className="w-full lg:w-[220px] shrink-0 border-t lg:border-t-0 lg:border-l border-border p-4 flex flex-col gap-4">
            <div>
              <h3 className="text-label text-text-muted mb-2 uppercase tracking-wider">Scores</h3>
              <div className="flex flex-col gap-3">
                {scoreBars.map((s) => (
                  <div key={s.label}>
                    <div className="flex justify-between text-cell mb-1">
                      <span className="text-text-secondary">{s.label}</span>
                      <span className="text-text-primary font-semibold" style={{ color: s.value >= 70 ? undefined : undefined }}>
                        {s.value}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-surface-base overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${s.color}`}
                        style={{ width: `${s.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-label text-text-muted mb-2 uppercase tracking-wider">Stats</h3>
              <div className="text-cell space-y-1">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Vol 24h</span>
                  <span className="text-text-primary tabular-nums">{formatVol(token.volume24h)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">24h High</span>
                  <span className="text-text-primary tabular-nums">${token.high24h.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">24h Low</span>
                  <span className="text-text-primary tabular-nums">${token.low24h.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Funding</span>
                  <span className={`tabular-nums ${Math.abs(token.fundingRate) < 0.01 ? "text-signal-green" : "text-signal-red"}`}>
                    {(token.fundingRate * 100).toFixed(4)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">OI</span>
                  <span className="text-text-primary tabular-nums">{formatVol(token.openInterest)}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-label text-text-muted mb-2 uppercase tracking-wider">Tags</h3>
              <div className="flex flex-wrap gap-1">
                {token.tags.map((t) => (
                  <span key={t} className="tag-blue text-[10px]">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatVol(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}
