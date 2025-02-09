create table messages (
  id text primary key,
  content text not null,
  role text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  model text not null,
  host text not null
);

---

-- Enable RLS
alter table messages enable row level security;

-- Create a policy that allows all operations
create policy "Allow all operations for messages"
on messages
for all
using (true)
with check (true);

---

-- 채팅 세션 테이블 생성
create table chat_sessions (
  id text primary key,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- messages 테이블에 chat_session_id 컬럼 추가
alter table messages 
add column chat_session_id text references chat_sessions(id);

-- chat_sessions 테이블에 RLS 활성화
alter table chat_sessions enable row level security;

-- chat_sessions 테이블에 정책 추가
create policy "Allow all operations for chat_sessions"
on chat_sessions
for all
using (true)
with check (true);