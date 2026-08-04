'use client';

import { openCookiePreferences } from '@/lib/cookie-consent';
import { ReactNode } from 'react';

type HomeFooterCookieLinkProps = {
  className?: string;
  children?: ReactNode;
};

export function HomeFooterCookieLink({
  className,
  children = 'Cookiebeleid',
}: HomeFooterCookieLinkProps) {
  return (
    <button
      type="button"
      onClick={openCookiePreferences}
      className={className}
    >
      {children}
    </button>
  );
}
