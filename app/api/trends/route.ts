import { NextResponse } from 'next/server';

// Cache management - 국가별 캐시 관리
const trendingCaches: Record<string, any> = {};
const lastFetchTimes: Record<string, number> = {};
const CACHE_TTL = 8 * 60 * 60 * 1000; // 8 hours in milliseconds (3 times per day)

export async function GET(request: Request) {
  // URL 쿼리 파라미터에서 국가 코드 추출
  const url = new URL(request.url);
  const geoCode = url.searchParams.get('geo') || 'US';
  
  const currentTime = Date.now();
  
  // 해당 국가의 캐시가 유효한지 확인
  if (trendingCaches[geoCode] && (currentTime - (lastFetchTimes[geoCode] || 0) < CACHE_TTL)) {
    console.log(`Returning cached trending data for ${geoCode}`);
    return NextResponse.json({
      ...trendingCaches[geoCode],
      geo: geoCode
    });
  }
  
  try {
    // 해당 국가의 최신 데이터 가져오기
    console.log(`Fetching fresh trending data for ${geoCode}`);
    
    // API key - use environment variable or fallback to demo key
    const apiKey = process.env.SEARCH_API_KEY || 'sBXPFT9SUvdBVfbXwaFF5SKR';
    
    // According to the documentation, API key can be passed as query parameter
    // or in Authorization header with Bearer prefix
    const response = await fetch(
      `https://www.searchapi.io/api/v1/search?engine=google_trends_trending_now&geo=${geoCode}&time=past_24_hours&api_key=${apiKey}`, 
      {
        // Use next.js cache capabilities as additional safeguard
        next: { revalidate: CACHE_TTL / 1000 }
      }
    );
    
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 상위 10개 트렌드만 추출하여 처리
    const top10Trends = data.trends
      .slice(0, 10)
      .map((trend: any) => ({
        query: trend.query,
        position: trend.position,
        search_volume: trend.search_volume,
        categories: trend.categories || []
      }));
    
    // 해당 국가의 캐시 업데이트
    trendingCaches[geoCode] = { 
      trends: top10Trends,
      lastUpdated: new Date().toISOString()
    };
    lastFetchTimes[geoCode] = currentTime;
    
    return NextResponse.json({
      ...trendingCaches[geoCode],
      geo: geoCode
    });
  } catch (error) {
    console.error(`Error fetching trending data for ${geoCode}:`, error);
    
    // 만료된 캐시라도 있다면 폴백으로 사용
    if (trendingCaches[geoCode]) {
      return NextResponse.json({
        ...trendingCaches[geoCode],
        geo: geoCode,
        error: 'Data may be outdated due to fetch error'
      });
    }
    
    // 해당 국가의 데이터가 없다면 기본값(US)으로 시도
    if (geoCode !== 'US' && trendingCaches['US']) {
      return NextResponse.json({
        ...trendingCaches['US'],
        geo: 'US',
        error: `Failed to fetch trending data for ${geoCode}, showing US data instead`
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch trending data', geo: geoCode },
      { status: 500 }
    );
  }
} 