-- 기존 정책 삭제
drop policy if exists "Allow all operations for messages" on messages;
drop policy if exists "Users can only access their own messages" on messages;
drop policy if exists "Allow all operations for chat_sessions" on chat_sessions;
drop policy if exists "Users can only access their own chat sessions" on chat_sessions;

-- 기존 테이블 삭제 (messages를 먼저 삭제해야 함 - 외래 키 제약조건 때문)
drop table if exists messages;
drop table if exists chat_sessions;

-- 이제 새로운 테이블과 정책 생성
create table messages (
  id text primary key,
  content text not null,
  role text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  model text not null,
  host text not null
);

alter table messages enable row level security;

create policy "Allow all operations for messages"
on messages
for all
using (true)
with check (true);

create table chat_sessions (
  id text primary key,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table messages 
add column chat_session_id text references chat_sessions(id);

alter table chat_sessions enable row level security;

create policy "Allow all operations for chat_sessions"
on chat_sessions
for all
using (true)
with check (true);

---

-- messages 테이블에 reasoning 컬럼 추가
alter table messages
add column reasoning text;