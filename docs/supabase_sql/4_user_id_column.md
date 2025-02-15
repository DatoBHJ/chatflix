-- messages 테이블에 user_id 컬럼 추가
alter table messages
add column user_id uuid references auth.users(id);

-- chat_sessions 테이블에 user_id 컬럼 추가
alter table chat_sessions
add column user_id uuid references auth.users(id);

-- messages 테이블의 RLS 정책 수정
drop policy if exists "Allow all operations for messages" on messages;
create policy "Users can only access their own messages"
on messages
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- chat_sessions 테이블의 RLS 정책 수정
drop policy if exists "Allow all operations for chat_sessions" on chat_sessions;
create policy "Users can only access their own chat sessions"
on chat_sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);