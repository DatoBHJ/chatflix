- lemon squish
- 모델 스위칭 에러
- 이미지 인풋

---

- 정지 후 편집시, 에러가 나옴
(1 of 1 error
Next.js (15.1.6) out of date (learn more) (Turbopack)

Console Error

Failed to get message sequence: {}

Source
app/chat/[id]/page.tsx (837:17) @ handleEditSave

  835 |
  836 |       if (seqError) {
> 837 |         console.error('Failed to get message sequence:', seqError);
      |                 ^
  838 |         return;
  839 |       }
  840 |
Show ignored frames)



- 숏컷 생성 최신순 정렬. 최신에 만든게 가장 위에 와야함. 
- 방향키로 컨트롤할 경우 그에 맞게 스크롤되어야함. 
- 입력창에 사용자 입력을 복사 붙여넣기한 후 추가로 숏컷을 사용하려고 하면 하면 숏컷 이름 맨션이 인식 안됨 
--- 

- 사용자 인풋 편집 기능 추가
- 생성된 답변의 모델을 바로 바꿔서 재생성할 수 있는 기능 추가
