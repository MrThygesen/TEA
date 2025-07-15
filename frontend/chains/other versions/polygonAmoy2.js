import { defineChain } from 'viem'

export const polygonAmoy = defineChain({
  id: 80002,
  name: 'Polygon Amoy',
  network: 'polygon-amoy',
  nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        // fallback public RPC
        'https://polygon-amoy.drpc.org',
      ],
      webSocket: [],
    },
    alchemy: {
      http: [
        `https://polygon-amoy.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
      ],
      webSocket: [],
    },
  },
  blockExplorers: {
    default: { name: 'AmoyScan', url: 'https://www.oklink.com/amoy' },
  },
  testnet: true,
})

