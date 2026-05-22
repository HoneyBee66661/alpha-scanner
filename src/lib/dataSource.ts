import type { TokenRow } from "../types";
import { fetchAllTokens } from "./binance";
import { fetchCoinGeckoTokens } from "./coingecko";
import { generateMockTokens } from "./mockData";

export type DataSource = "auto" | "binance" | "coingecko";

export interface FetchResult {
  tokens: TokenRow[];
  source: DataSource;
  isMock: boolean;
  error?: string;
}

export async function fetchFromSource(
  source: DataSource
): Promise<FetchResult> {
  if (source === "binance") {
    try {
      const tokens = await fetchAllTokens();
      return { tokens, source: "binance", isMock: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Binance fetch failed";
      const tokens = generateMockTokens();
      return { tokens, source: "binance", isMock: true, error: msg };
    }
  }

  if (source === "coingecko") {
    try {
      const tokens = await fetchCoinGeckoTokens();
      return { tokens, source: "coingecko", isMock: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "CoinGecko fetch failed";
      const tokens = generateMockTokens();
      return { tokens, source: "coingecko", isMock: true, error: msg };
    }
  }

  // auto: try Binance first, then CoinGecko, then mock
  try {
    const tokens = await fetchAllTokens();
    return { tokens, source: "binance", isMock: false };
  } catch {
    // Binance failed, try CoinGecko
  }

  try {
    const tokens = await fetchCoinGeckoTokens();
    return { tokens, source: "coingecko", isMock: false };
  } catch {
    // Both failed, use mock
  }

  const tokens = generateMockTokens();
  return {
    tokens,
    source: "auto",
    isMock: true,
    error: "Binance and CoinGecko both unreachable. VPN may be required.",
  };
}

const LS_SOURCE = "ascan_datasource";

export function loadSourcePreference(): DataSource {
  try {
    const v = localStorage.getItem(LS_SOURCE);
    if (v === "binance" || v === "coingecko" || v === "auto") return v;
  } catch {
    // localStorage unavailable
  }
  return "auto";
}

export function saveSourcePreference(source: DataSource): void {
  try {
    localStorage.setItem(LS_SOURCE, source);
  } catch {
    // localStorage unavailable
  }
}
