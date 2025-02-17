-- prompt_shortcuts 테이블 생성
create table prompt_shortcuts (
  id text primary key,
  name text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id)
);

-- name과 user_id에 대한 유니크 제약 추가
alter table prompt_shortcuts
add constraint unique_name_per_user unique (name, user_id);

alter table prompt_shortcuts enable row level security;

-- RLS 정책 생성
create policy "Users can only access their own prompt shortcuts"
on prompt_shortcuts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 프롬프트 숏컷 검색 함수
create or replace function search_prompt_shortcuts(
  p_user_id uuid,
  p_search_term text
)
returns table (
  id text,
  name text,
  content text
)
language plpgsql
security definer
as $$
begin
  return query
  select ps.id, ps.name, ps.content
  from prompt_shortcuts ps
  where ps.user_id = p_user_id
    and ps.name ilike p_search_term || '%'
  order by ps.name
  limit 5;
end;
$$; 