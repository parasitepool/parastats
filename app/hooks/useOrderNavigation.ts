'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { orderHref } from '@/app/utils/refinery-links';

export function useOrderNavigation() {
  const router = useRouter();
  return useCallback((id: number) => router.push(orderHref(id)), [router]);
}
