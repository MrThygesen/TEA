import { useAccount, useWalletClient } from 'wagmi';
import { getContracts } from '../lib/contracts';
import { ethers } from 'ethers';

export function useTeaContracts() {
  const { data: walletClient } = useWalletClient();
  const { isConnected } = useAccount();

  const providerOrSigner = walletClient
    ? new ethers.BrowserProvider(walletClient)
    : undefined;

  return isConnected && providerOrSigner
    ? getContracts(providerOrSigner)
    : {};
}

