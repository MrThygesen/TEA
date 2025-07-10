# TEA — Web3 Trust, Identity & Loyalty Platform
  
**Project TEA** is an innovative Web3 platform designed to revolutionize trust and identity by combining decentralized meetings, loyalty programs, smart legal contracts, and social agreements — all powered by blockchain technology.

Deployed on the Polygon Amoy Testnet, TEA leverages Soulbound Tokens (SBTs) to provide verified identity and loyalty perks for individual and group interactions, alongside admin tools for creating enforceable agreements and future-proof escrow solutions.


# TEA — Product demo on Polygon Amoy Testnet

Product demo is out now on https://tea-dn40fh6q8-metaheads-projects-5a43a03e.vercel.app/

---

### 🧭 Setting Up MetaMask for Web3 Access

If you're new to Web3, you'll need to install [MetaMask](https://metamask.io/) as a browser extension.
To interact with our demo, you'll also need to **manually add the Polygon Amoy Testnet** to MetaMask (this is required, otherwise it won’t work).

---

### 🔧 Add Polygon Amoy Testnet to MetaMask

Use the following configuration:

```
📛  Network Name:      Polygon Amoy
🔗  New RPC URL:       https://polygon-amoy-bor-rpc.publicnode.com
🆔  Chain ID:          80002
💰  Currency Symbol:   MATIC
🔍  Block Explorer:    https://amoy.polygonscan.com
```
---

## Why TEA?

- **Trust & Identity:** Verifiable, non-transferable SBTs create reliable digital identities and social proof.
- **Loyalty & Rewards:** Seamlessly link loyalty perks and discounts to identity and participation.
- **Smart Legal & Social Contracts:** Codify agreements transparently on-chain with automated enforcement.
- **Future-Ready Escrow:** Protect stakeholders with no-show penalties and deposit refunds.

---

## Current Demo Features

- Soulbound Tokens (SBTs) for meeting attendance and loyalty verification  
- Legal and social contract creation via smart contracts  
- Admin interface for issuing and managing SBT agreements  
- Deployed smart contracts on Polygon Amoy Testnet  
- React + Next.js frontend hosted on Vercel for easy access  

---

## Tech Stack

- **Solidity 0.8.20** with **OpenZeppelin 4.9.5** for secure, upgradeable smart contracts  
- Development & Auditing with **Hardhat**, **Foundry**, and **Slither**  
- Frontend built with **React** + **Next.js**, integrating **Ethers.js v6** and **wagmi** for wallet connectivity  
- CI/CD and deployment via **GitHub** and **Vercel**

---

## 🛠️ Contracts on Polygon Amoy Testnet

- **TEAToken.sol**  
  `0x3477B92C56AFE14859dB695861306273bFC74B69`

- **TokenVesting.sol**  
  `0x1e69549fad1495ace3f99f39425240bca74ad6d6`

- **TokenAllocationnew.sol**  
  `0x0fa9a93918c2e5fff06265d609648b5447fa3616`


- **WebAccessSBTV3.sol**  
  `0x3276C93eeFFad65426B0bd1B4d6eEfa105FEd6B2`


- **Investigate your transactions to claim undelivered SBTs**  
  `0x576c2c7544c180De7EBCa37d25c6c08Db543bBBF` 


    In some testnets, the SBT / NFT are not shown directly and has to be imported to be visible in the wallet.
    This has for instance occured in the metamasks mobilephone wallet.

    Look in the NFT section and insert the contract number: 0x576c2c7544c180De7EBCa37d25c6c08Db543bBBF (this is the main SBT address) and find your token ID and insert
    it as collectible ID.

    The Token ID is found easily with below link for PolygonScan with your wallet-account-number. Here is the overview of all transactions made with your account on
    polygon amoy testnet.

    The one you are looking has the Method: claim, click on transaction hash and find the Token ID. Insert numbers and import the file.

    SBT Contract on Polygon Amoy Testnet:
    https://amoy.polygonscan.com/address/wallet-account-number, 

    Remember that all contracts on testnet are only for testing and development, and does not count for free offers before its announced. 


## Roadmap & Future Plans

| Phase                      | Goals & Deliverables                                        | Timeline       |
|----------------------------|------------------------------------------------------------|----------------|
| **Phase 1: Demo**           | Deploy core contracts and frontend; admin SBT issuance     | Completed      |
| **Phase 2: Mainnet**        | Launch SBT and core ERC contracts on Polygon mainnet; integrate NDA/legal contract support | Q3–Q4 2025     |
| **Phase 3: DAO**            | Launch governance DAO for community-led proposals          | Q4 2025        |
| **Phase 4: Discounts & Escrow** | Develop discount programs and escrow/no-show penalty services | Q1 2026        |

---

## Why Join Us?

- **Investors:** Be part of the next wave in decentralized identity and loyalty, with a demo-ready product and clear roadmap.  
- **Developers:** Contribute to cutting-edge Solidity contracts and modern React frontend in a high-impact Web3 ecosystem.  
- **Partners:** Collaborate on integrating loyalty, legal contracts, and community governance into real-world use cases.

---

## Get Involved

- ⭐ Star the repo to stay updated  
- 🐛 Report issues and request features  
- 💬 Join the discussion and organize meetings through our telegram channel (soon coming)  
- 👩‍💻 Submit pull requests or contact us to contribute
- ⭐ business inquiries or investor discussions, contact: morten@defineers.com or connect on linkedin.com/in/mortenthygesens/

---

Thank you for your interest in TEA — together, we can build trust and identity for the Web3 era.

---

*This project is currently in testnet/demo phase. All contracts and software are open-source and under active development.*
