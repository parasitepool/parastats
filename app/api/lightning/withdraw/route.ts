import { handleLightningWithdrawRequest } from './handler';

export async function POST(request: Request) {
  return handleLightningWithdrawRequest(request, {
    upstreamAction: 'withdraw',
    fallbackError: 'Failed to execute withdraw',
    logLabel: 'Lightning withdraw failed',
  });
}
