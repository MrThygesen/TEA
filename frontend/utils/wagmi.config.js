import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { polygon, polygonAmoy } from 'wagmi/chains'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

export const config = getDefaultConfig({
  appName: 'TEA Project',
  projectId,
  chains: [polygonAmoy, polygon], // testnet first
  ssr: true,
})

