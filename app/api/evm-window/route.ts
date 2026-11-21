import { NextResponse, type NextRequest } from "next/server";
import { evmWindowEndpoint } from "@/lib/config";
import {
  evmAddressToBech32,
  isQorBech32Address,
} from "@/lib/qorechain/address";

/**
 * Same-origin proxy for the QoreChain EVM-window REST endpoint.
 *
 * Two reasons this exists:
 *  1. The upstream REST service is not guaranteed to send CORS headers, so the
 *     browser must never call it directly.
 *  2. The endpoint requires a **bech32** (`qor1…`) account address. Passing the
 *     0x address returns HTTP 400 "invalid bech32 address". The proxy performs
 *     that encoding so callers can keep using the EVM address.
 *
 * Both inputs are validated so this cannot become an open proxy.
 */
export const dynamic = "force-dynamic";

function resolveAccount(address: string): string | null {
  if (/^0x[0-9a-fA-F]{40}$/.test(address)) return evmAddressToBech32(address);
  if (isQorBech32Address(address)) return address.toLowerCase();
  return null;
}

export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("address") ?? "").trim();
  const account = resolveAccount(raw);
  if (!account) {
    return NextResponse.json(
      { error: "A 20-byte 0x address or a qor1… bech32 address is required." },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(evmWindowEndpoint(account), {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "The QoreChain REST endpoint is unavailable." },
      { status: 502 },
    );
  }
}
