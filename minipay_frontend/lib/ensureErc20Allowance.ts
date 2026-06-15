import { type Address, type Hash, type PublicClient, maxUint256 } from 'viem';
import Erc20Abi from '@/context/abi/ERC20abi.json';

export async function readErc20Allowance(
  publicClient: PublicClient,
  token: Address,
  owner: Address,
  spender: Address,
): Promise<bigint> {
  return publicClient.readContract({
    address: token,
    abi: Erc20Abi,
    functionName: 'allowance',
    args: [owner, spender],
  }) as Promise<bigint>;
}

export async function waitForTxConfirmed(publicClient: PublicClient, hash: Hash): Promise<void> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === 'reverted') {
    throw new Error('Transaction reverted on-chain');
  }
}

type ApproveFn = (token: Address, spender: Address, amount: bigint) => Promise<Hash | void | undefined>;

/**
 * Reads allowance on-chain (not from React cache), approves if needed, and waits for confirmation.
 * Use `unlimited: true` for shop flows so users can buy multiple perks without re-approving.
 */
export async function ensureErc20Allowance(options: {
  publicClient: PublicClient;
  token: Address;
  owner: Address;
  spender: Address;
  requiredAmount: bigint;
  approve: ApproveFn;
  /** Approve max uint256 — recommended for repeat purchases in the perk shop */
  unlimited?: boolean;
}): Promise<void> {
  const { publicClient, token, owner, spender, requiredAmount, approve, unlimited = false } = options;

  const current = await readErc20Allowance(publicClient, token, owner, spender);
  if (current >= requiredAmount) return;

  const approveAmount = unlimited ? maxUint256 : requiredAmount;
  const hash = await approve(token, spender, approveAmount);
  if (hash) {
    await waitForTxConfirmed(publicClient, hash);
  }
}
