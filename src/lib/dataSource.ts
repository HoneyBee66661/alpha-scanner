import type { TokenRow } from '../types/index.js';
import { fetchAllTokens } from './binance.js';
import { generateMockTokens } from './mockData.js';

export type DataSource = "binance";

export interface FetchResult {
  tokens: TokenRow[];
  source: DataSource;
  isMock: boolean;
  error?: string;
}

function normalizeTokens(tokens: TokenRow[]): TokenRow[] {
  return tokens.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export async function fetchFromSource(
  source: DataSource
): Promise<FetchResult> {
  try {
    const tokens = normalizeTokens(await fetchAllTokens());
    return { tokens, source: "binance", isMock: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Binance fetch failed";
    const tokens = normalizeTokens(generateMockTokens());
    return { tokens, source: "binance", isMock: true, error: msg };
  }
}

const LS_SOURCE = "ascan_datasource";

export function loadSourcePreference(): DataSource {
  return "binance";
}

export function saveSourcePreference(source: DataSource): void {
  try {
    localStorage.setItem(LS_SOURCE, source);
  } catch {
    // localStorage unavailable
  }
}
