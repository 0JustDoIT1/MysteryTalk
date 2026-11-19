# 캐릭터 프롬프트 (PRD D102·D103)

탐정 캐릭터 2종과 NPC 그림을 AI 이미지 생성으로 만들기 위한 프롬프트. 맵·카드·힌트 프롬프트는 [ART_PROMPTS.md](ART_PROMPTS.md). 본편 NPC 프롬프트(25명 전체)는 비공개 사건 저장소 `drafts/ART_PROMPTS_CHARACTERS.md`.

## 1. 규칙
- **저장 위치·이름**: 탐정은 `frontend/public/sprites/detectives/<id>.png`(2종: noir·inspector), NPC는 `frontend/public/sprites/npc/<그림 이름>.png`. NPC 그림 이름은 역할 기준의 일반 이름이라(예: `head-nurse`) 진상을 드러내지 않는다. NPC 그림을 넣으면 사건 데이터의 NPC에 `sprite`를 적는다(Claude가 함).
- **규격(화면 반영 전 Claude가 맞춤)**: 한 칸 64×64px(화면에서는 32px 칸에 맞춰 그림). 탐정은 3열 × 4행 = 192×256, NPC는 앞모습 한 장 64×64. 배경은 투명. 생성 도구가 큰 그림을 내면 줄이고 가장자리를 다듬는다.
- **탐정이 한 장의 격자로 잘 안 나올 때**: 앞·왼쪽·오른쪽·뒤 네 방향 서 있는 그림을 따로 만들어도 된다(걷기 프레임은 서 있는 그림으로 채움).
- **특정 작품 캐릭터 금지**: 일반적인 사설탐정·형사 유형으로만 그린다(특정 만화·소설 캐릭터의 고유한 옷·소품 조합을 그대로 쓰지 않는다, D103).
- **NPC는 직업이 한눈에**: 옷과 소품만 보고 직업을 알 수 있게 한다. 범인·피해자 여부가 드러나는 표정·소품(피, 무기, 술병 등)은 넣지 않는다(D35).
- **기록**: 도구·생성일을 `ASSETS.md`에 적는다(공개 폴더에 들어가는 그림).

### 캐릭터 스타일 블록
```
Pixel art character for a top-down 16-bit JRPG (RPG Maker style), chibi proportions (about 2.5 heads tall),
clean dark outline, limited palette, soft shading, matches warm pixel-art map backgrounds,
fully transparent background, no shadow on the ground, no text, no logos, no watermark.
```

## 2. 탐정 캐릭터 2종(D103)
플레이어가 '탐정 정하기' 창과 설정에서 고른다. 그림이 오기 전에는 자체 제작 도트(색만 다름)를 쓴다(`frontend/scripts/make-detective-sprite.mjs`).

### [ ] 사설탐정 `detectives/noir.png`(192×256, 3열 × 4행)
```
Pixel art character for a top-down 16-bit JRPG (RPG Maker style), chibi proportions (about 2.5 heads tall),
clean dark outline, limited palette, soft shading, matches warm pixel-art map backgrounds,
fully transparent background, no shadow on the ground, no text, no logos, no watermark.
Character sprite sheet: 3 columns x 4 rows, every cell the same size and the character centered in each cell.
Columns: left foot forward, standing, right foot forward. Rows from top: facing down (toward viewer), facing left, facing right, facing up (back view).
The same character in every cell: a private eye (civilian detective) in a gray fedora hat and a long beige trench coat with the collar up, a small notebook in hand, calm and observant. Gender-neutral look.
```

### [ ] 강력계 형사 `detectives/inspector.png`(192×256, 3열 × 4행)
```
Pixel art character for a top-down 16-bit JRPG (RPG Maker style), chibi proportions (about 2.5 heads tall),
clean dark outline, limited palette, soft shading, matches warm pixel-art map backgrounds,
fully transparent background, no shadow on the ground, no text, no logos, no watermark.
Character sprite sheet: 3 columns x 4 rows, every cell the same size and the character centered in each cell.
Columns: left foot forward, standing, right foot forward. Rows from top: facing down (toward viewer), facing left, facing right, facing up (back view).
The same character in every cell: a homicide police detective with short dark hair and no hat, a short black leather jacket over a gray shirt, jeans, a police badge clipped on the belt, a walkie-talkie, energetic stance. Gender-neutral look.
```

## 3. 공개 사건 NPC
### [ ] 튜토리얼 아르바이트생 → `npc/part-timer.png`(64×64)
```
Pixel art character for a top-down 16-bit JRPG (RPG Maker style), chibi proportions (about 2.5 heads tall),
clean dark outline, limited palette, soft shading, matches warm pixel-art map backgrounds,
fully transparent background, no shadow on the ground, no text, no logos, no watermark.
Single full-body character standing and facing the viewer (front view), centered, square image.
The outfit and props must make the job (bakery part-timer) instantly recognizable at a small size.
A young woman in her early 20s, ponytail, cream bakery apron over a striped shirt, holding a bread tray.
```

### [ ] 샘플 제자 → `npc/student-girl.png`(64×64)
```
Pixel art character for a top-down 16-bit JRPG (RPG Maker style), chibi proportions (about 2.5 heads tall),
clean dark outline, limited palette, soft shading, matches warm pixel-art map backgrounds,
fully transparent background, no shadow on the ground, no text, no logos, no watermark.
Single full-body character standing and facing the viewer (front view), centered, square image.
The outfit and props must make the job (high school piano student) instantly recognizable at a small size.
A Korean high school girl in a navy school uniform, a music score folder under her arm, backpack.
```

### [ ] 샘플 관리인 → `npc/building-manager.png`(64×64)
```
Pixel art character for a top-down 16-bit JRPG (RPG Maker style), chibi proportions (about 2.5 heads tall),
clean dark outline, limited palette, soft shading, matches warm pixel-art map backgrounds,
fully transparent background, no shadow on the ground, no text, no logos, no watermark.
Single full-body character standing and facing the viewer (front view), centered, square image.
The outfit and props must make the job (building manager) instantly recognizable at a small size.
An older man in his 60s, gray hair, khaki work jacket with a key ring on the belt, holding a flashlight.
```
