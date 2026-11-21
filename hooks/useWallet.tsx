"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BrowserProvider, type Signer } from "ethers";
import { CHAIN } from "@/lib/config";
import { getReadProvider } from "@/lib/blockchain/provider";
import { errorMessage } from "@/lib/utils";

interface Eip1193Provider {
  request(args: {
    method: string;
    params?: unknown[] | Record<string, unknown>;
  }): Promise<unknown>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
}

type WalletStatus = "uninitialized" | "disconnected" | "connecting" | "connected";

interface WalletContextValue {
  status: WalletStatus;
  address: string | null;
  chainId: number | null;
  balance: bigint | null;
  error: string | null;
  isQoreChain: boolean;
  providerAvailable: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  getSigner: () => Promise<Signer>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function injected(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { ethereum?: Eip1193Provider }).ethereum ?? null
  );
}

function parseChainId(value: unknown): number | null {
  if (typeof value === "string" && value.startsWith("0x")) {
    return Number.parseInt(value, 16);
  }
  if (typeof value === "number") return value;
  return null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>("uninitialized");
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerAvailable, setProviderAvailable] = useState(false);
  const browserProvider = useRef<BrowserProvider | null>(null);

  const refreshBalance = useCallback(async () => {
    const eth = injected();
    const current =
      browserProvider.current ?? (eth ? new BrowserProvider(eth) : null);
    const accounts = address;
    if (!current || !accounts) {
      setBalance(null);
      return;
    }
    browserProvider.current = current;
    try {
      const chain = parseChainId(await current.send("eth_chainId", []));
      if (chain !== CHAIN.id) {
        setBalance(null);
        return;
      }
      const value = await getReadProvider().getBalance(accounts);
      setBalance(value);
    } catch {
      setBalance(null);
    }
  }, [address]);

  const disconnect = useCallback(async () => {
    const eth = injected();
    if (eth) {
      try {
        await eth.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch {
        // Not supported by every wallet; clearing local state is enough.
      }
    }
    browserProvider.current = null;
    setAddress(null);
    setChainId(null);
    setBalance(null);
    setError(null);
    setStatus("disconnected");
  }, []);

  const connect = useCallback(async () => {
    const eth = injected();
    if (!eth) {
      setError(
        "No EIP-1193 wallet detected. Install QoreX or MetaMask and refresh.",
      );
      setStatus("disconnected");
      return;
    }
    setStatus("connecting");
    setError(null);
    try {
      const accounts = (await eth.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error("Wallet returned no accounts.");
      }
      const provider = new BrowserProvider(eth);
      browserProvider.current = provider;
      const network = await provider.getNetwork();
      setAddress(accounts[0]);
      setChainId(Number(network.chainId));
      setStatus("connected");
      const value = await provider.getBalance(accounts[0]);
      setBalance(value);
    } catch (err) {
      const message = errorMessage(err);
      setError(
        message.includes("4001") || /reject/i.test(message)
          ? "Connection request was rejected in your wallet."
          : message,
      );
      setStatus("disconnected");
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    const eth = injected();
    if (!eth) {
      setError("No EIP-1193 wallet detected.");
      return;
    }
    setError(null);
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN.hexId }],
      });
    } catch (err) {
      const message = errorMessage(err);
      const numericCode = (err as { code?: number } | null)?.code;
      if (numericCode === 4902 || /Unrecognized chain/i.test(message)) {
        try {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: CHAIN.hexId,
                chainName: CHAIN.name,
                nativeCurrency: CHAIN.currency,
                rpcUrls: [CHAIN.rpcUrl],
                blockExplorerUrls: [CHAIN.explorerUrl],
              },
            ],
          });
          return;
        } catch (addError) {
          setError(errorMessage(addError));
          return;
        }
      }
      if (numericCode === 4001) {
        setError("Network switch was rejected in your wallet.");
        return;
      }
      setError(message);
    }
  }, []);

  const getSigner = useCallback(async (): Promise<Signer> => {
    const eth = injected();
    if (!eth) throw new Error("No EIP-1193 wallet detected.");
    const provider = browserProvider.current ?? new BrowserProvider(eth);
    browserProvider.current = provider;
    return provider.getSigner();
  }, []);

  // Restore an existing session silently (no prompt) and subscribe to changes.
  useEffect(() => {
    const eth = injected();
    setProviderAvailable(Boolean(eth));
    if (!eth) {
      setStatus("disconnected");
      return;
    }
    let cancelled = false;

    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = (args[0] as string[] | undefined) ?? [];
      if (accounts.length === 0) {
        void disconnect();
      } else {
        setAddress(accounts[0]);
        setStatus("connected");
      }
    };
    const onChainChanged = (...args: unknown[]) => {
      // Ethers caches the detected network. Drop the provider so the next
      // signer/balance read is created against the new chain.
      browserProvider.current = null;
      setChainId(parseChainId(args[0]));
      setBalance(null);
    };

    eth.on("accountsChanged", onAccountsChanged);
    eth.on("chainChanged", onChainChanged);

    void (async () => {
      try {
        const accounts = (await eth.request({
          method: "eth_accounts",
        })) as string[];
        if (cancelled) return;
        if (accounts.length > 0) {
          const provider = new BrowserProvider(eth);
          browserProvider.current = provider;
          const network = await provider.getNetwork();
          if (cancelled) return;
          setAddress(accounts[0]);
          setChainId(Number(network.chainId));
          setStatus("connected");
        } else {
          setStatus("disconnected");
        }
      } catch {
        if (!cancelled) setStatus("disconnected");
      }
    })();

    return () => {
      cancelled = true;
      eth.removeListener("accountsChanged", onAccountsChanged);
      eth.removeListener("chainChanged", onChainChanged);
    };
  }, [disconnect]);

  // Keep the QOR balance fresh on chain/account changes.
  useEffect(() => {
    if (status !== "connected" || !address) return;
    void refreshBalance();
  }, [status, address, chainId, refreshBalance]);

  const value = useMemo<WalletContextValue>(
    () => ({
      status,
      address,
      chainId,
      balance,
      error,
      isQoreChain: chainId === CHAIN.id,
      providerAvailable,
      connect,
      disconnect,
      switchNetwork,
      refreshBalance,
      getSigner,
    }),
    [
      status,
      address,
      chainId,
      balance,
      error,
      providerAvailable,
      connect,
      disconnect,
      switchNetwork,
      refreshBalance,
      getSigner,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used within WalletProvider");
  return context;
}
