"use client";

import {
  toViemAccount,
  PrivyProvider,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { hyperliquidEvmTestnet } from "viem/chains";
import * as hl from "@nktkas/hyperliquid";
import BigNumber from "bignumber.js";

const privy_app_id = "cmgziwlwt04irl20c68twt5d9";

function formatPrice(price: BigNumber, szDecimals: number): string {
  const decimals = Math.max(0, szDecimals);
  return price.toFixed(decimals, BigNumber.ROUND_DOWN);
}

function formatSize(size: BigNumber, szDecimals: number): string {
  const decimals = Math.max(0, szDecimals);
  return size.toFixed(decimals, BigNumber.ROUND_DOWN);
}

export default function Home() {
  return (
    <PrivyProvider
      appId={privy_app_id}
      config={{
        defaultChain: hyperliquidEvmTestnet,
        supportedChains: [hyperliquidEvmTestnet],
        loginMethods: ["google", "email", "wallet"],
        embeddedWallets: {
          showWalletUIs: false,
          ethereum: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      <PlaceOrder />
    </PrivyProvider>
  );
}

function PlaceOrder() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();

  const wallet = wallets[0];

  const placeOrder = async () => {
    if (!wallet) return;

    const viemAccount = await toViemAccount({ wallet });

    // Create Hyperliquid account
    const transport = new hl.HttpTransport({ isTestnet: true });
    const client = new hl.ExchangeClient({
      transport,
      wallet: viemAccount,
    });
    const infoClient = new hl.InfoClient({ transport });

    // pre transfer check
    const preTransferCheck = await infoClient.preTransferCheck({
      user: wallet.address,
      source: wallet.address,
    });

    console.log(preTransferCheck);

    // Get available assets
    const metaAndCtx = await infoClient.metaAndAssetCtxs();
    const meta = metaAndCtx[0];
    const ctx = metaAndCtx[1];

    // Find the asset index for BTC
    const btcIndex = meta.universe.findIndex(
      (asset: { name: string }) => asset.name === "BTC"
    );
    const universe = meta.universe[btcIndex];
    const btcContext = ctx[btcIndex];

    const price = formatPrice(
      new BigNumber(btcContext.markPx).times(1.01),
      universe.szDecimals
    );
    const triggerPrice = formatPrice(
      new BigNumber(btcContext.markPx).times(0.99),
      universe.szDecimals
    );
    const size = formatSize(
      new BigNumber(15).div(btcContext.markPx),
      universe.szDecimals
    );

    // Place a market order
    const orderResponse = await client.order({
      orders: [
        {
          a: btcIndex, // Asset index
          b: true, // Buy order
          s: size, // Size
          r: false, // Not reduce-only
          p: price, // Price (0 for market order)
          t: {
            trigger: { isMarket: true, tpsl: "tp", triggerPx: triggerPrice },
          }, // Market order
        },
      ],
      grouping: "na", // No grouping
    });
    console.log("Order placed:", orderResponse);

    // Check open positions
    const userState = await infoClient.clearinghouseState({ user: address });
    console.log("Account state:", userState);
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <button
          onClick={login}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Login
        </button>
      </div>
    );
  }

  const address = user?.wallet?.address || "No address";

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="text-sm text-gray-600 mb-2">{address}</div>
        <button
          onClick={placeOrder}
          className="px-8 py-4 bg-blue-600 text-white text-lg rounded-lg hover:bg-blue-700 transition-colors"
        >
          Place Order
        </button>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
