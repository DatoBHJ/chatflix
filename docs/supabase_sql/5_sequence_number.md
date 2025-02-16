-- messages 테이블에 sequence_number 컬럼 추가
alter table messages
add column sequence_number bigint not null default 0;

-- 시퀀스 번호를 위한 인덱스 생성
create index if not exists idx_messages_chat_sequence 
on messages(chat_session_id, sequence_number);

-- 기존 메시지들의 시퀀스 번호 업데이트
with numbered_messages as (
  select 
    id,
    chat_session_id,
    row_number() over (partition by chat_session_id order by created_at) as new_sequence
  from messages
)
update messages m
set sequence_number = nm.new_sequence
from numbered_messages nm
where m.id = nm.id; 