import { BrowserProvider, JsonRpcProvider, type Eip1193Provider } from "ethers";
import { CHAIN } from "@/lib/config";

let readProvider: JsonRpcProvider | null = null;

export function getReadProvider(): JsonRpcProvider {
  if (!readProvider) {
    readProvider = new JsonRpcProvider(CHAIN.rpcUrl, CHAIN.id, {
      staticNetwork: true,
      batchMaxCount: 20,
    });
  }
  return readProvider;
}

export function getBrowserProvider(): BrowserProvider | null {
  if (typeof window === "undefined") return null;
  const injected = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  if (!injected) return null;
  return new BrowserProvider(injected);
}

export function hasInjectedProvider(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as { ethereum?: Eip1193Provider }).ethereum);
}
