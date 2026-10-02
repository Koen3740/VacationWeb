'use client';

import {
  canLoadOptionalCategory,
  CONSENT_CHANGED_EVENT,
  getConsentRecord,
  type ConsentRecord,
} from '@/lib/cookie-consent';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ConsentContextValue = {
  record: ConsentRecord | null;
  ready: boolean;
  analyticsAllowed: boolean;
  marketingAllowed: boolean;
  refresh: () => void;
};

const ConsentContext = createContext<ConsentContextValue>({
  record: null,
  ready: false,
  analyticsAllowed: false,
  marketingAllowed: false,
  refresh: () => undefined,
});

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [record, setRecord] = useState<ConsentRecord | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setRecord(getConsentRecord());
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [refresh]);

  const value = useMemo<ConsentContextValue>(
    () => ({
      record,
      ready,
      analyticsAllowed: record?.analytics === true && canLoadOptionalCategory('analytics'),
      marketingAllowed: record?.marketing === true && canLoadOptionalCategory('marketing'),
      refresh,
    }),
    [record, ready, refresh],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  return useContext(ConsentContext);
}
