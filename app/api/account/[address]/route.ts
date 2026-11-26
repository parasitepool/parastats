import { NextResponse } from 'next/server';
import { isValidBitcoinAddress, normalizeBitcoinAddress } from '@/app/utils/validators';
import type { CombinedAccountResponse, AccountData, WalletInfo, BalanceResponse } from '@/app/api/account/types';
import { fetchWithTimeout } from '@/app/api/lib/fetch-with-timeout';
import { fetchWithCache } from '@/lib/aggregator-cache';
import { HttpError } from '@/lib/http-client';
import { clearLightningTokenCookie, readLightningToken } from '@/lib/lightning-session';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    const { address: rawAddress } = await params;

    if (!rawAddress) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const address = normalizeBitcoinAddress(rawAddress);
    if (!isValidBitcoinAddress(address)) {
      return NextResponse.json({ error: 'Invalid Bitcoin address' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const includeLightning = searchParams.get('includeLightning') === '1';
    const lightningToken = includeLightning ? readLightningToken(request, address) : null;

    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      console.error('Failed to fetch user account: No API_URL defined in env');
      return NextResponse.json({ error: 'Failed to fetch user account' }, { status: 500 });
    }

    const headers: Record<string, string> = {};
    if (process.env.API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.API_TOKEN}`;
    }

    const accountPromise = (async (): Promise<AccountData | null> => {
      try {
        const url = `${apiUrl}/account/${address}`;
        const { data } = await fetchWithCache<AccountData | null>(url, async () => {
          const response = await fetchWithTimeout(url, { headers });
          if (response.ok) {
            return (await response.json()) as AccountData;
          }
          if (response.status === 404) {
            return null;
          }
          throw new HttpError(response.status, response.statusText, url);
        });
        return data;
      } catch (error) {
        console.error('Error fetching account data:', error instanceof Error ? error.message : 'Unknown error');
        return null;
      }
    })();

    const lightningPromise = (async (): Promise<{
      lightningData: { walletInfo: WalletInfo; balance: number } | null;
      lightningTokenExpired: boolean;
    }> => {
      if (!includeLightning) {
        return { lightningData: null, lightningTokenExpired: false };
      }

      if (!lightningToken) {
        return { lightningData: null, lightningTokenExpired: true };
      }

      const lightningApiUrl = process.env.LIGHTNING_API_URL;
      if (!lightningApiUrl) {
        return { lightningData: null, lightningTokenExpired: false };
      }

      try {
        const [userResponse, balanceResponse] = await Promise.all([
          fetchWithTimeout(`${lightningApiUrl}/wallet_user`, {
            headers: { Authorization: `Bearer ${lightningToken}` },
          }),
          fetchWithTimeout(`${lightningApiUrl}/wallet_user/balance`, {
            headers: { Authorization: `Bearer ${lightningToken}` },
          }),
        ]);

        if (userResponse.status === 401 || balanceResponse.status === 401) {
          return { lightningData: null, lightningTokenExpired: true };
        }
        if (userResponse.ok && balanceResponse.ok) {
          const [userData, balanceData] = await Promise.all([
            userResponse.json() as Promise<WalletInfo>,
            balanceResponse.json() as Promise<BalanceResponse>,
          ]);
          return {
            lightningData: {
              walletInfo: userData,
              balance: balanceData.balance,
            },
            lightningTokenExpired: false,
          };
        }
      } catch (error) {
        console.error('Error fetching lightning data:', error instanceof Error ? error.message : 'Unknown error');
      }
      return { lightningData: null, lightningTokenExpired: false };
    })();

    const [accountData, { lightningData, lightningTokenExpired }] = await Promise.all([
      accountPromise,
      lightningPromise,
    ]);

    const combinedResponse: CombinedAccountResponse = {
      account: accountData,
      lightning: lightningData,
      ...(lightningTokenExpired && { lightningTokenExpired: true }),
    };

    const response = NextResponse.json(combinedResponse, {
      headers: { 'Cache-Control': 'private, no-store' },
    });

    if (lightningTokenExpired) {
      clearLightningTokenCookie(response, request, address);
    }

    return response;
  } catch (error) {
    console.error('Error in account endpoint:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to fetch account data' }, { status: 500 });
  }
}
