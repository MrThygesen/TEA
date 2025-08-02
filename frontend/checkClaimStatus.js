import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import { createPublicClient, http } from 'viem';
import { polygon } from 'viem/chains';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables explicitly from .env.local next to this script
dotenv.config({ path: path.join(__dirname, '.env.local') });

console.log('Loaded RPC URL:', process.env.NEXT_PUBLIC_RPC_URL);

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
if (!RPC_URL) {
  throw new Error("NEXT_PUBLIC_RPC_URL not set in environment");
}

const CONTRACT_ADDRESS = "0x4f22580C5FdfcEAF80189877d6E961D6B11994c3"; // Your deployed contract address
const TYPE_ID_TO_CHECK = 60; // The SBT typeId you want to check
const ADDRESS_TO_CHECK = "0x171662aC1B3172330cdF727c5Be917ceAfB14D54"; // The user address you want to check

async function main() {
  // Load ABI JSON file from abis folder relative to this script
  const abiJson = await readFile(path.join(__dirname, "abis", "WebAccessSBTV32_ABI.json"), "utf8");
  
  // IMPORTANT: The ABI file is expected to be a JSON array at top level
  const contractABI = JSON.parse(abiJson);

  // Create viem public client with Polygon chain and your RPC URL
  const client = createPublicClient({
    chain: polygon,
    transport: http(RPC_URL),
  });

  // Call the hasClaimed mapping view function on the contract
  const claimed = await client.readContract({
    address: CONTRACT_ADDRESS,
    abi: contractABI,
    functionName: "hasClaimed",
    args: [TYPE_ID_TO_CHECK, ADDRESS_TO_CHECK],
  });

  console.log(`Address ${ADDRESS_TO_CHECK} has${claimed ? "" : " NOT"} claimed SBT type ${TYPE_ID_TO_CHECK}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

