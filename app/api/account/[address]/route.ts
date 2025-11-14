import { NextResponse } from 'next/server';
import { isValidBitcoinAddress } from '@/app/utils/validators';
import { toAccountData } from '@/app/api/account/shared';
import type { CombinedAccountResponse, AccountData, WalletInfo, BalanceResponse } from '@/app/api/account/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    if (!isValidBitcoinAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Bitcoin address' },
        { status: 400 }
      );
    }

    // Get lightning token from header if present
    const lightningToken = request.headers.get('X-Lightning-Token');

    // Fetch account data
    let accountData: AccountData | null = null;
    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      console.error("Failed to fetch user account: No API_URL defined in env");
      return NextResponse.json({ error: "Failed to fetch user account" }, { status: 500 });
    }

    const headers: Record<string, string> = {};
    if (process.env.API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
    }

    try {
      const response = await fetch(`${apiUrl}/account/${address}`, {
        headers,
      });

      if (response.ok) {
        const json = await response.json();
        accountData = toAccountData(json);
      }
      // If response is not ok (e.g., 404), accountData stays null
    } catch (error) {
      console.error("Error fetching account data:", error);
      // accountData stays null
    }

    // Fetch lightning data if token is provided
    let lightningData: { walletInfo: WalletInfo; balance: number } | null = null;
    if (lightningToken) {
      const lightningApiUrl = process.env.LIGHTNING_API_URL || 'https://api.bitbit.bot';
      
      try {
        const [userResponse, balanceResponse] = await Promise.all([
          fetch(`${lightningApiUrl}/wallet_user`, {
            headers: { Authorization: `Bearer ${lightningToken}` },
          }),
          fetch(`${lightningApiUrl}/wallet_user/balance`, {
            headers: { Authorization: `Bearer ${lightningToken}` },
          }),
        ]);

        if (userResponse.ok && balanceResponse.ok) {
          const userData: WalletInfo = await userResponse.json();
          const balanceData: BalanceResponse = await balanceResponse.json();
          lightningData = {
            walletInfo: userData,
            balance: balanceData.balance,
          };
        }
      } catch (error) {
        console.error("Error fetching lightning data:", error);
        // lightningData stays null
      }
    }

    const combinedResponse: CombinedAccountResponse = {
      account: accountData,
      lightning: lightningData,
    };

    return NextResponse.json(combinedResponse);
  } catch (error) {
    console.error("Error in account endpoint:", error);
    return NextResponse.json(
      { error: "Failed to fetch account data" },
      { status: 500 }
    );
  }
}
