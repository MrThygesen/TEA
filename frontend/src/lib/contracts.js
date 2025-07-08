import { ethers } from "ethers";
import TEATokenABI from "../abi/TEAToken.json";
import TokenVestingABI from "../abi/TokenVesting.json";
import TokenAllocationABI from "../abi/TokenAllocation.json";

export function getContracts(providerOrSigner) {
  return {
    teaToken: new ethers.Contract(
      process.env.NEXT_PUBLIC_CONTRACT_TEATOKEN,
      TEATokenABI,
      providerOrSigner
    ),
    tokenVesting: new ethers.Contract(
      process.env.NEXT_PUBLIC_CONTRACT_VESTING,
      TokenVestingABI,
      providerOrSigner
    ),
    tokenAllocation: new ethers.Contract(
      process.env.NEXT_PUBLIC_CONTRACT_ALLOCATION,
      TokenAllocationABI,
      providerOrSigner
    ),
  };
}

