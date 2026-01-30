import { NextRequest, NextResponse } from 'next/server';

import { LinkMetadataError, fetchLinkMetadata } from '@/app/lib/linkMetadataFetcher';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const metadata = await fetchLinkMetadata(url);
    return NextResponse.json(metadata);
  } catch (error) {
    console.error('Error fetching link metadata:', error);
    console.error('URL that failed:', url);
    const status =
      error instanceof LinkMetadataError
        ? error.status
        : 500;
    return NextResponse.json(
      {
        error: 'Failed to fetch link metadata',
        details: error instanceof Error ? error.message : 'Unknown error',
        url
      },
      { status }
    );
  }
}