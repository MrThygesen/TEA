import { defineChain } from 'viem'

export const polygon = defineChain({
  id: 137,
  name: 'Polygon Mainnet',
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://polygon-rpc.com'],  // consider Alchemy/Infura
    },
  },
  blockExplorers: {
    default: { name: 'Polygonscan', url: 'https://polygonscan.com' },
  },
})

