import { handleLightningWithdrawRequest } from '../handler';

export async function POST(request: Request) {
  return handleLightningWithdrawRequest(request, {
    upstreamAction: 'withdraw_quote',
    fallbackError: 'Failed to get withdraw quote',
    logLabel: 'Lightning withdraw quote failed',
  });
}
