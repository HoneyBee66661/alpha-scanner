import type { TokenRow } from "../../types";
import ScannerTable from "../scanner/ScannerTable";

interface Props {
  tokens: TokenRow[];
  loading: boolean;
}

export default function AccumulationRadar({ tokens, loading }: Props) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-card">
        <span className="text-heading text-text-primary">Accumulation Radar</span>
        <span className="text-label text-text-muted">
          Assets with increasing activity and limited price movement
        </span>
      </div>
      <ScannerTable
        tokens={tokens.sort((a, b) => b.accumulation - a.accumulation)}
        loading={loading}
        highlightScore="accumulation"
      />
    </div>
  );
}
