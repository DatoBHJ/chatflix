import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from "@upstash/qstash";

// 스케줄 설정 API
export async function POST(request: Request) {
  try {
    // QStash 클라이언트 초기화
    const qstash = new Client({
      token: process.env.QSTASH_TOKEN!,
    });
    
    // 요청 본문 파싱
    const body = await request.json();
    const scheduleType = body.type || "both"; // "generate", "update", "both" 중 하나
    const generateCron = body.generate_cron || "0 2 * * 1"; // 기본값: 매주 월요일 2AM
    const updateCron = body.update_cron || "0 3 * * 1"; // 기본값: 매주 월요일 3AM
    
    // 현재 URL에서 기본 URL 추출
    const requestUrl = new URL(request.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    
    const result = {
      success: true,
      schedules: [] as any[],
      message: ""
    };
    
    // 프로필 생성 스케줄 설정 (type이 generate 또는 both인 경우)
    if (scheduleType === "generate" || scheduleType === "both") {
      const generateSchedule = await (qstash.schedules as any).create({
        destination: `${baseUrl}/api/admin/profiles/generate`,
        cron: generateCron,
        retries: 3,
        body: JSON.stringify({ batch_size: 10, auto_batch: true })
      });
      
      result.schedules.push({
        type: "generate",
        schedule_id: generateSchedule.scheduleId,
        cron: generateCron
      });
    }
    
    // 프로필 업데이트 스케줄 설정 (type이 update 또는 both인 경우)
    if (scheduleType === "update" || scheduleType === "both") {
      const updateSchedule = await (qstash.schedules as any).create({
        destination: `${baseUrl}/api/admin/profiles/update`,
        cron: updateCron,
        retries: 3,
        body: JSON.stringify({ min_new_messages: 20, batch_size: 10, auto_batch: true })
      });
      
      result.schedules.push({
        type: "update",
        schedule_id: updateSchedule.scheduleId,
        cron: updateCron
      });
    }
    
    // 결과 메시지 설정
    if (result.schedules.length > 0) {
      result.message = `${result.schedules.length}개의 프로필 처리 스케줄이 생성되었습니다.`;
    } else {
      result.message = "스케줄이 생성되지 않았습니다. 유효한 type 값을 지정하세요.";
      result.success = false;
    }
    
    // 결과 반환
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error setting up QStash schedule:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// 스케줄 관리 API
export async function PUT(request: Request) {
  try {
    // QStash 클라이언트 초기화
    const qstash = new Client({
      token: process.env.QSTASH_TOKEN!,
    });
    
    // 요청 본문 파싱
    const body = await request.json();
    const { schedule_id, active } = body;
    
    if (!schedule_id) {
      return NextResponse.json({ error: 'schedule_id is required' }, { status: 400 });
    }
    
    // 스케줄 활성화/비활성화 - 타입 문제를 방지하기 위해 any 타입으로 처리
    if (active) {
      await (qstash.schedules as any).resume({ schedule: schedule_id });
    } else {
      await (qstash.schedules as any).pause({ schedule: schedule_id });
    }
    
    // 결과 반환
    return NextResponse.json({
      success: true,
      schedule_id,
      status: active ? 'resumed' : 'paused',
      message: `Schedule ${active ? 'resumed' : 'paused'} successfully`
    });
  } catch (error) {
    console.error('Error managing QStash schedule:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// 현재 스케줄 목록 조회 API
export async function GET(request: Request) {
  try {
    // QStash 클라이언트 초기화
    const qstash = new Client({
      token: process.env.QSTASH_TOKEN!,
    });
    
    // 현재 설정된 스케줄 목록 조회
    const schedules = await (qstash.schedules as any).list();
    
    // 결과 반환
    return NextResponse.json({
      success: true,
      schedules: schedules
    });
  } catch (error) {
    console.error('Error getting QStash schedules:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
} 