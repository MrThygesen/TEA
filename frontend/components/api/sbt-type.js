// pages/api/sbt-type.js
import { ethers } from 'ethers'
import { WebAccessSBTV3_ABI } from '../../abis/WebAccessSBTV3_ABI'

const CONTRACT_ADDRESS = '0x576c2c7544c180De7EBCa37d25c6c08Db543bBBF'

export default async function handler(req, res) {
  try {
    const { typeId } = req.query
    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL)
    const contract = new ethers.Contract(CONTRACT_ADDRESS, WebAccessSBTV3_ABI, provider)
    const type = await contract.sbtTypes(typeId)

    res.status(200).json({
      typeId,
      uri: type.uri,
      active: type.active,
      burnable: type.burnable,
      maxSupply: type.maxSupply.toString(),
      minted: type.minted.toString(),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

