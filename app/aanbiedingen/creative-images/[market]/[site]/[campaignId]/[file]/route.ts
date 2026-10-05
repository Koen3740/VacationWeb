import { readCreativeImage } from '@/lib/tradetracker/promotions/creative-images';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Serves a banner that ingest already stored for VacationWeb.
 * Local file first, then the isolated R2/S3 key when credentials exist.
 * Never redirects to TradeTracker and never requests /i or /c.
 */
export async function GET(
  _request: Request,
  context: { params: { market: string; site: string; campaignId: string; file: string } },
): Promise<NextResponse> {
  const image = await readCreativeImage(context.params);
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
