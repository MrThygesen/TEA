export const WebAccessSBTV3_ABI = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "typeId", "type": "uint256" }
    ],
    "name": "claim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "typeId", "type": "uint256" }
    ],
    "name": "sbtTypes",
    "outputs": [
      { "internalType": "string",   "name": "uri",       "type": "string" },
      { "internalType": "bool",     "name": "burnable",  "type": "bool" },
      { "internalType": "bool",     "name": "active",    "type": "bool" },
      { "internalType": "uint256",  "name": "maxSupply", "type": "uint256" },
      { "internalType": "uint256",  "name": "minted",    "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "typeId", "type": "uint256" },
      { "internalType": "address", "name": "user",   "type": "address" }
    ],
    "name": "hasClaimed",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  }
]

