// chains/polygonAmoy.js

export const polygonAmoy = {
  id: 80002,
  name: 'Polygon Amoy',
  network: 'polygon-amoy',
  nativeCurrency: {
    name: 'MATIC', // Use MATIC for compatibility with wallets like MetaMask
    symbol: 'MATIC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://polygon-amoy.g.alchemy.com/v2/uPx7m6oqDM4MVFBfx8Reh'],
    },
    public: {
      http: ['https://rpc-amoy.polygon.technology'],
    },
  },
  blockExplorers: {
    default: {
      name: 'AmoyScan',
      url: 'https://amoy.polygonscan.com',
    },
  },
  testnet: true,
  iconUrl: 'https://polygon.technology/media-kit/matic-token-icon.png',
  iconBackground: '#8247E5',
};

