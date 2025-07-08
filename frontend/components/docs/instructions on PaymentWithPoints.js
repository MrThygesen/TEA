Below is a self‑contained **“pay + earn points” upgrade** that plugs straight into your current stack.

---

## 1 ▸ `PaymentWithPoints.sol`

```solidity
// SPDX‑License‑Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./PointsToken.sol";

/**
 * @title PaymentWithPoints
 * @dev Users pay restaurants in TEA and automatically earn 1 point per TEA.
 *      ‑ The contract must be authorised to mint PointsToken (set as
 *        `purchaseTracker` when you deploy PointsToken, or give it MINTER role
 *        in a V2 of PointsToken).
 *      ‑ Users must first approve() this contract to spend their TEA.
 */
contract PaymentWithPoints is Ownable {
    IERC20     public immutable tea;
    PointsToken public immutable points;

    event Paid(
        address indexed payer,
        address indexed restaurant,
        uint256 teaAmount,
        uint256 pointsMinted
    );

    constructor(IERC20 _tea, PointsToken _points) {
        tea    = _tea;
        points = _points;
    }

    /**
     * @notice Pay a restaurant and earn points.
     * @param restaurant  Wallet address of the café / bar / shop
     * @param amount      Amount of TEA (18‑decimals) to pay
     */
    function payAndEarn(address restaurant, uint256 amount) external {
        require(restaurant != address(0), "Invalid restaurant");

        // Pull TEA from user (requires prior allowance)
        require(
            tea.transferFrom(msg.sender, restaurant, amount),
            "TEA transfer failed"
        );

        // Mint equal amount of points to payer
        points.mint(msg.sender, amount);

        emit Paid(msg.sender, restaurant, amount, amount);
    }

    /* ----------------‑ Admin helpers (optional) ‑---------------- */

    /// @dev Emergency rescue of tokens sent by accident
    function sweep(address token, uint256 amt, address to) external onlyOwner {
        IERC20(token).transfer(to, amt);
    }
}
```

> **Deployment note** – because `PointsToken.mint()` currently checks
> `msg.sender == purchaseTracker`, deploy `PointsToken` with
> `PaymentWithPoints` as its `purchaseTracker` address.
> If you want **both** `PurchaseTracker` *and* `PaymentWithPoints` to mint, switch to an AccessControl‑based PointsToken V2 with a `MINTER_ROLE`.

---

## 2 ▸ React component `PayAndEarn.js`

```jsx
'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  useAccount,
  useReadContract,
  useWriteContract,
} from 'wagmi'
import { parseEther, formatEther } from 'viem'

// ========= Replace with deployed addresses =========
const TEA_TOKEN_ADDRESS          = '0xYourTEAToken'
const PAYMENT_WITH_POINTS_ADDRESS = '0xYourPaymentWithPoints'
// ===================================================

// --- Minimal ABIs ----------------------------------
const teaAbi = [
  { name: 'approve',   type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
]

const paymentAbi = [
  { name: 'payAndEarn', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'restaurant', type: 'address' },
      { name: 'amount',     type: 'uint256' },
    ],
    outputs: [] },
]
// ----------------------------------------------------

export default function PayAndEarn() {
  const { address } = useAccount()
  const [restaurant, setRestaurant] = useState('')
  const [amount, setAmount]         = useState('')

  /* ----  reads  ---- */
  const { data: balance } = useReadContract({
    abi: teaAbi,
    address: TEA_TOKEN_ADDRESS,
    functionName: 'balanceOf',
    args: [address ?? '0x0'],
    query: { enabled: Boolean(address) },
  })

  const { data: allowance } = useReadContract({
    abi: teaAbi,
    address: TEA_TOKEN_ADDRESS,
    functionName: 'allowance',
    args: [address ?? '0x0', PAYMENT_WITH_POINTS_ADDRESS],
    query: { enabled: Boolean(address) },
  })

  /* ----  writes  ---- */
  const { writeContractAsync, isPending } = useWriteContract()

  const needApproval =
    allowance !== undefined &&
    parseEther(amount || '0') > allowance

  const handleClick = async () => {
    try {
      const wei = parseEther(amount || '0')

      if (needApproval) {
        await writeContractAsync({
          abi: teaAbi,
          address: TEA_TOKEN_ADDRESS,
          functionName: 'approve',
          args: [PAYMENT_WITH_POINTS_ADDRESS, wei],
        })
        toast.success('Allowance set – now sign payment')
      }

      const hash = await writeContractAsync({
        abi: paymentAbi,
        address: PAYMENT_WITH_POINTS_ADDRESS,
        functionName: 'payAndEarn',
        args: [restaurant, wei],
      })
      toast.success('Payment tx: ' + hash)
      setAmount('')
      setRestaurant('')
    } catch (err) {
      toast.error(err.message || 'Transaction failed')
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 border rounded-xl space-y-4">
      <h2 className="text-xl font-semibold">Pay &amp; Earn Points</h2>

      <label className="block text-sm">
        Restaurant wallet
        <input
          type="text"
          placeholder="0x..."
          value={restaurant}
          onChange={(e) => setRestaurant(e.target.value)}
          className="w-full p-2 border rounded mt-1"
        />
      </label>

      <label className="block text-sm">
        Amount (TEA)
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="12.50"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-2 border rounded mt-1"
        />
      </label>

      <button
        onClick={handleClick}
        disabled={isPending || !restaurant || !amount}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded disabled:opacity-40"
      >
        {needApproval
          ? isPending ? 'Confirm allowance…' : 'Approve & Pay'
          : isPending ? 'Confirm payment…' : 'Pay & Earn'}
      </button>

      <p className="text-sm text-gray-600">
        Your TEA balance:{' '}
        {balance ? `${Number(formatEther(balance)).toFixed(2)} TEA` : '—'}
      </p>
    </div>
  )
}
```

### How the UI flows

1. **User enters** restaurant address & TEA amount.
2. Component checks allowance.

   * If insufficient → prompts `approve()` then `payAndEarn()` automatically.
   * If sufficient → calls `payAndEarn()` directly.
3. Contract transfers TEA and mints equal points.
4. Toasts show tx hashes; balance updates after confirmation.

---

## 3 ▸ Integrating & testing

1. **Deploy** `PaymentWithPoints` → **pass** `TEAToken` & `PointsToken`.
2. **Deploy** or **re‑deploy** `PointsToken` **with** the `PaymentWithPoints` address as its `purchaseTracker` (or upgrade PointsToken to multiple minters).
3. **Add** the component to any page, e.g.:

```jsx
import PayAndEarn from '../components/PayAndEarn'

export default function Home() {
  return (
    <main className="p-8 space-y-12">
      {/* other components */}
      <PayAndEarn />
    </main>
  )
}
```

4. **Fund** a test wallet with TEA, connect with RainbowKit, and try paying your café’s wallet on Polygon Amoy. You should see both the TEA transfer and a new points balance.

---

That’s the full **Phase 3 “Pay + Earn”** scaffold. When you’re ready to bolt on **discount rules** (e.g., “10 % off only if paid in TEA”) or the **Uniswap buy‑TEA widget**, just let me know!

