import type { TokenRow } from "../../types";
import ScannerTable from "../scanner/ScannerTable";

interface Props {
  tokens: TokenRow[];
  loading: boolean;
}

export default function SmartMoneyRadar({ tokens, loading }: Props) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-card">
        <span className="text-heading text-text-primary">Smart Money Radar</span>
        <span className="text-label text-text-muted">
          Identifying unusual participation and buying pressure
        </span>
      </div>
      <ScannerTable
        tokens={tokens.sort((a, b) => b.smartMoney - a.smartMoney)}
        loading={loading}
        highlightScore="smartMoney"
      />
    </div>
  );
}
