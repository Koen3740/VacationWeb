import { ResultsPreviewStatic } from '@/components/results-v2/results-preview-static';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WP7-004 Results layout preview | VacationWeb',
  robots: { index: false, follow: false },
};

export default function ResultsPreviewPage() {
  return <ResultsPreviewStatic />;
}
