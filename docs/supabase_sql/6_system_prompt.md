-- system_prompts 테이블 생성
create table system_prompts (
  id text primary key,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id)
);

alter table system_prompts enable row level security;

-- RLS 정책 생성
create policy "Users can only access their own system prompts"
on system_prompts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 기본 시스템 프롬프트 설정을 위한 함수 생성
create or replace function get_or_create_system_prompt(p_user_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_prompt_id text;
  v_content text;
begin
  -- 사용자의 시스템 프롬프트 확인
  select id, content into v_prompt_id, v_content
  from system_prompts
  where user_id = p_user_id
  limit 1;
  
  -- 시스템 프롬프트가 없으면 기본값 생성
  if v_prompt_id is null then
    v_prompt_id := 'sp-' || gen_random_uuid()::text;
    v_content := 'You are a helpful AI assistant. Use appropriate markdown syntax for code blocks, lists, tables, and other formatting elements.';
    
    insert into system_prompts (id, content, user_id)
    values (v_prompt_id, v_content, p_user_id);
  end if;
  
  return v_content;
end;
$$; 