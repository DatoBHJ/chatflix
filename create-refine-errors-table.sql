-- Memory refine 에러 추적 테이블 생성
CREATE TABLE IF NOT EXISTS refine_errors (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  category VARCHAR(50) NOT NULL,
  error_message TEXT NOT NULL,
  error_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_refine_errors_user_id ON refine_errors(user_id);
CREATE INDEX IF NOT EXISTS idx_refine_errors_created_at ON refine_errors(created_at);
CREATE INDEX IF NOT EXISTS idx_refine_errors_error_type ON refine_errors(error_type);

-- RLS (Row Level Security) 설정
ALTER TABLE refine_errors ENABLE ROW LEVEL SECURITY;

-- 서비스 역할이 모든 데이터에 접근할 수 있도록 정책 생성
CREATE POLICY "Service role can access all refine_errors" ON refine_errors
  FOR ALL USING (true);
