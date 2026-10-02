'use client';

import { useConsent } from '@/components/consent/consent-provider';
import type { ReactNode } from 'react';

type ConsentGateProps = {
  category: 'analytics' | 'marketing';
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * Renders children only when the user has opted in for the category.
 * No analytics/marketing providers are installed; this gate stays closed by default.
 */
export function ConsentGate({ category, children, fallback = null }: ConsentGateProps) {
  const { ready, analyticsAllowed, marketingAllowed } = useConsent();

  if (!ready) {
    return <>{fallback}</>;
  }

  const allowed = category === 'analytics' ? analyticsAllowed : marketingAllowed;
  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
