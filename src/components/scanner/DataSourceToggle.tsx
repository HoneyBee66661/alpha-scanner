import type { DataSource } from "../../lib/dataSource";

interface Props {
  value: DataSource;
  onChange: (source: DataSource) => void;
  activeSource: DataSource;
  isMock: boolean;
}

const options: { value: DataSource; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "binance", label: "Binance" },
  { value: "coingecko", label: "CoinGecko" },
];

export default function DataSourceToggle({ value, onChange, activeSource, isMock }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-label text-text-muted mr-1">Data:</span>
      <div className="flex rounded border border-border overflow-hidden">
        {options.map((opt) => {
          const isActive = value === opt.value;
          const isLiveSource = activeSource === opt.value && !isMock;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`px-2.5 py-1 text-label transition-colors ${
                isActive
                  ? "bg-signal-blue/20 text-signal-blue font-semibold"
                  : "text-text-muted hover:text-text-secondary hover:bg-white/5"
              }`}
              title={
                isLiveSource
                  ? `Live data from ${opt.label}`
                  : isActive && isMock
                    ? `${opt.label} unavailable — using simulated data`
                    : `Switch to ${opt.label}`
              }
            >
              {opt.label}
              {isLiveSource && <span className="ml-1 text-signal-green">*</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
