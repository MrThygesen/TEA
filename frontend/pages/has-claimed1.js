// pages/api/has-claimed.js
import { ethers } from 'ethers'
import { WebAccessSBTV3_ABI } from '../../abis/WebAccessSBTV3_ABI'

const CONTRACT_ADDRESS = '0x576c2c7544c180De7EBCa37d25c6c08Db543bBBF'

export default async function handler(req, res) {
  try {
    const { typeId, user } = req.query
    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, WebAccessSBTV3_ABI, provider)
    const claimed = await contract.hasClaimed(typeId, user)
    res.status(200).json(claimed)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

