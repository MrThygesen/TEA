// checkActiveTypes.js
import 'dotenv/config'
import { createPublicClient, http } from 'viem'
import { polygonAmoy } from 'viem/chains'
import { parseAbi } from 'viem'

const CONTRACT_ADDRESS = '0x648BB7c9e0867aE6B58ff6ac65e0Dc52062B394e'

async function listActiveTypes(publicClient) {
  for (let typeId = 1; typeId <= 10; typeId++) {
    try {
      const active = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: parseAbi(['function isTypeActive(uint256) view returns (bool)']),
        functionName: 'isTypeActive',
        args: [typeId],
      })
      console.log(`Type ${typeId} is ${active ? 'ACTIVE' : 'INACTIVE'}`)
    } catch (err) {
      console.log(`Error fetching type ${typeId}:`, err.message)
    }
  }
}

async function main() {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL
  if (!rpcUrl) {
    console.error('Please set NEXT_PUBLIC_RPC_URL in your .env file')
    process.exit(1)
  }

  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http(rpcUrl),
  })

  await listActiveTypes(publicClient)
}

main()

