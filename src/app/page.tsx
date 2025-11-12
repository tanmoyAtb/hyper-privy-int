"use client";

import { useState } from "react";
import {
  toViemAccount,
  PrivyProvider,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { hyperliquidEvmTestnet } from "viem/chains";
import * as hl from "@nktkas/hyperliquid";

const privy_app_id = "cmgziwlwt04irl20c68twt5d9";

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
          ethereum: { createOnLogin: "all-users" },
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
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const wallet = wallets[0];

  console.log(wallets);

  const getHLClient = async () => {
    const transport = new hl.HttpTransport({ isTestnet: true });
    const hlInfoClient = new hl.InfoClient({ transport });

    const eoaWallet = wallets.find((w) => w.walletClientType != "privy");
    const embeddedWallet = wallets.find((w) => w.walletClientType == "privy");

    if (eoaWallet && embeddedWallet) {
      console.log("In eoa and embedded wallet system");

      const eoaViemAccount = await toViemAccount({ wallet: eoaWallet });
      const embeddedViemAccount = await toViemAccount({
        wallet: embeddedWallet,
      });

      console.log("eoaViemAccount", eoaViemAccount);
      console.log("embeddedViemAccount", embeddedViemAccount);

      const eoaExchangeClient = new hl.ExchangeClient({
        wallet: eoaViemAccount,
        transport,
      });

      console.log("Approving agents");

      // register the embedded viem account as the agent wallet
      await eoaExchangeClient.approveAgent({
        agentAddress: embeddedWallet.address as `0x${string}`,
        agentName: "Privy Agent",
      });

      console.log("approved");

      // use the embedded account to submit transactions
      const hlClient = new hl.ExchangeClient({
        wallet: embeddedViemAccount,
        transport,
      });

      return { hlClient, hlInfoClient };
    } else if (embeddedWallet) {
      console.log("embedded wallet system");
      const embeddedViemAccount = await toViemAccount({
        wallet: embeddedWallet,
      });
      const hlClient = new hl.ExchangeClient({
        wallet: embeddedViemAccount,
        transport,
      });
      return { hlClient, hlInfoClient };
    }
  };

  const placeOrder = async () => {
    if (isPlacingOrder) {
      console.log("Order already in progress...");
      return;
    }

    try {
      setIsPlacingOrder(true);

      if (!wallet) {
        console.error("No wallet available");
        return;
      }

      const hlClients = await getHLClient();

      if (!hlClients) {
        throw new Error("Failed to initialize clients");
      }

      const { hlClient, hlInfoClient } = hlClients;

      console.log("hl client", hlClient);

      // pre transfer check
      const preTransferCheck = await hlInfoClient.preTransferCheck({
        user: wallet.address,
        source: wallet.address,
      });

      console.log(preTransferCheck);

      // Place a triggered market order (p must be "0" for market orders)
      // const orderResponse = await hlClient.order({
      //   grouping: "na",
      //   orders: [
      //     {
      //       a: 3,
      //       b: true,
      //       p: "102210",
      //       r: false,
      //       s: "0.0001",
      //       t: { limit: { tif: "Gtc" } },
      //     },
      //   ],
      // });

      // console.log("Order placed:", orderResponse);

      // Check open positions
      const userState = await hlInfoClient.clearinghouseState({
        user: wallet.address,
      });
      console.log("Account state:", userState);
    } catch (error) {
      console.error("Error placing order:", error);
      // Log more details about the error
      if (error instanceof Error) {
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
    } finally {
      setIsPlacingOrder(false);
    }
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
          disabled={isPlacingOrder}
          className={`px-8 py-4 text-white text-lg rounded-lg transition-colors ${
            isPlacingOrder
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isPlacingOrder ? "Placing Order..." : "Place Order"}
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
