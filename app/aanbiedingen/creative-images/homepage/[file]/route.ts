import { readHomepageActionImage } from '@/lib/tradetracker/promotions/homepage-action-image';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Serves the stored Corendon homepage action image.
 * The browser never loads images.corendonresources.com or a TradeTracker /i URL.
 */
export async function GET(
  _request: Request,
  context: { params: { file: string } },
): Promise<NextResponse> {
  const image = await readHomepageActionImage(context.params.file);
  if (!image) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(new Uint8Array(image.bytes), {
    status: 200,
    headers: {
      'Content-Type': image.contentType,
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
