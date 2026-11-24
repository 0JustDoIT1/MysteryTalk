# 아트 프롬프트 (PRD D67·D94·D98)

AI 이미지 생성용 프롬프트 공통 규칙과 공개 사건(튜토리얼·샘플) 프롬프트. 비공개 사건 프롬프트(카드·맵 배경·힌트)는 각 사건 폴더 `images/SOURCES.md`에 있다. 튜토리얼·샘플은 글 힌트라 힌트 이미지가 없다.

## 1. 공통 규칙
- **화풍**: 쯔꾸르풍(16비트 JRPG) 탑뷰 3/4 시점 픽셀아트, 32px 격자. 모든 맵 프롬프트는 아래 스타일 블록으로 시작한다.
- **크기**: 맵 배경은 격자 칸 수 × 64px(2배)를 기본으로 한다(예: 16×9칸 → 1024×576). 1배·3배도 된다(D94, 적재 전 검사). 생성 도구가 정확한 크기를 못 내면 같은 비율로 만든 뒤 줄이거나 자른다.
- **좌표**: 조사 대상 위치는 현재 격자 기준(왼쪽 위가 0,0). 그림이 나오면 **그림에 맞춰 격자·좌표를 고친다**(가구 칸은 `#`, 조사 대상은 물건이 있는 칸).
- **사람·글자 금지**: 사람·캐릭터·동물은 그리지 않는다(캐릭터는 스프라이트로 얹음). 글자·숫자·로고도 넣지 않는다(필요하면 편집으로 얹음, 상호는 가상).
- **수위(D35)**: 시신·피·신체 훼손을 그리지 않는다.
- **카드 대표 그림(D98)**: 1024×576(16:9). 사건 개요에 나온 장면만 그리고 범인·수법·결정적 단서를 드러내지 않는다. 장르별 색: 미스터리 남색·회색, 공포 어두운 저채도 + 붉은 포인트, 범죄 호박색·짙은 갈색(지금 임시 그림 색과 같음).
- **기록**: 생성한 그림은 도구·프롬프트·생성일을 사건 폴더 `images/SOURCES.md`(공개 사건은 `ASSETS.md`)에 적고, 상업 이용 조건을 확인한다.
- **카드 대표 그림 넣기**: 사건 폴더 `images/`에 그림을 두고 `case.json`에 `"cover": "cover.png"`를 적은 뒤 `version`을 올린다. 16:9, 가로 512~1920px(적재 전 검사). 없으면 화면이 장르 색 임시 그림을 그린다.

### 맵 스타일 블록
```
Top-down 3/4 view pixel art game map, classic 16-bit JRPG (RPG Maker) style, 32px tile grid,
orthographic, no perspective distortion, flat soft lighting, clean pixel edges, limited palette.
```
맵 프롬프트 끝: `No people, no characters, no animals, no bodies, no blood, no text, no letters, no numbers, no logos, no watermark.`

### 힌트 스타일 블록(D92)

본편 힌트는 이미지 한 장(사건 자료 사진·화면 캡처처럼). 960×640(3:2). 글자·숫자는 비워 두고 생성한 뒤 편집으로 얹는다(사건 SOURCES.md에 "편집으로 얹을 글자"를 적어 둠). 사람은 얼굴이 보이지 않는 작은 인물로. 그림 내용은 데이터의 대체 텍스트(alt)와 맞아야 한다.

```
Pixel art evidence image for a detective game, 16-bit style, 3:2, 960x640,
looks like a case file photo or screenshot, clear readable composition, limited palette, clean pixel edges.
```

힌트 프롬프트 끝: `No readable text, no letters, no numbers (leave blank areas for text added later), no logos, no watermark, no blood, no gore, no visible faces.`

### 카드 스타일 블록
```
Pixel art scene illustration, 16-bit era adventure game style, 16:9, 1024x576,
side or three-quarter view, atmospheric lighting, limited palette, clean pixel edges.
```
카드 프롬프트 끝: `No people's faces, no bodies, no blood, no gore, no text, no letters, no numbers, no logos, no watermark.`

## 2. 공개 사건 프롬프트

### 사라진 금고 열쇠 (`tutorial-missing-key`)

#### 카드 대표 그림 `cover.png` (1024×576)

```
Pixel art scene illustration, 16-bit era adventure game style, 16:9, 1024x576,
side or three-quarter view, atmospheric lighting, limited palette, clean pixel edges.
A cozy small neighborhood bakery kitchen at dawn, a closed cash safe on the counter, an empty key hook on the wall, flour dust in warm light.
cool indigo and slate palette, quiet mood.
No people's faces, no bodies, no blood, no gore, no text, no letters, no numbers, no logos, no watermark.
```

#### 맵 배경 `kitchen-bg.png` (빵집 주방, 12×7칸 → 768×448)

대응: 카운터 서랍(2,1) = a shop counter with a drawer · 앞치마 걸이(8,1) = apron hooks on the wall · 오븐(2,5) = a large bakery oven

```
Top-down 3/4 view pixel art game map, classic 16-bit JRPG (RPG Maker) style, 32px tile grid,
orthographic, no perspective distortion, flat soft lighting, clean pixel edges, limited palette.
12 tiles wide by 7 tiles tall (768x448 px, 2x of 384x224).
The kitchen of a small neighborhood bakery in Korea, half an hour before opening, early morning. Ovens, flour sacks, steel work tables.
Solid boundary around the edges (walls indoors; fences, buildings or rock edges outdoors). Objects (tile x,y counted from the top-left, 0-based):
- a shop counter with a drawer at tile 2,1 (top left)
- apron hooks on the wall at tile 8,1 (top right)
- a large bakery oven at tile 2,5 (bottom left)
- an open doorway in the right wall (tile 11,3) leading to the backdoor area
Keep these floor tiles empty for characters: tile 5,2.
Leave the rest of the floor clear and walkable.
cool indigo and slate palette, quiet mood.
No people, no characters, no animals, no bodies, no blood, no text, no letters, no numbers, no logos, no watermark.
```

#### 맵 배경 `backdoor-bg.png` (뒷문 출입구, 10×4칸 → 640×256)

대응: 배달 기록표(6,1) = a desk with stacked documents

```
Top-down 3/4 view pixel art game map, classic 16-bit JRPG (RPG Maker) style, 32px tile grid,
orthographic, no perspective distortion, flat soft lighting, clean pixel edges, limited palette.
10 tiles wide by 4 tiles tall (640x256 px, 2x of 320x128).
The narrow back entrance passage of the same bakery, a delivery area with stacked crates, early morning.
Solid boundary around the edges (walls indoors; fences, buildings or rock edges outdoors). Objects (tile x,y counted from the top-left, 0-based):
- a desk with stacked documents at tile 6,1 (top center)
- an open doorway in the left wall (tile 0,1) leading to the kitchen area
Leave the rest of the floor clear and walkable.
cool indigo and slate palette, quiet mood.
No people, no characters, no animals, no bodies, no blood, no text, no letters, no numbers, no logos, no watermark.
```

### 302호의 정전 (`sample-blackout-302`)

#### 카드 대표 그림 `cover.png` (1024×576)

```
Pixel art scene illustration, 16-bit era adventure game style, 16:9, 1024x576,
side or three-quarter view, atmospheric lighting, limited palette, clean pixel edges.
A small three-story villa building at night seen from the street, every window lit except one on the third floor.
warm amber and dark brown palette, tense mood.
No people's faces, no bodies, no blood, no gore, no text, no letters, no numbers, no logos, no watermark.
```

#### 맵 배경 `living-bg.png` (302호 거실, 14×9칸 → 896×576)

대응: 피아노(2,2) = an upright piano · 손전등(3,4) = a flashlight lying on the floor · 전등 스위치(12,1) = a light switch on the wall · 거실 탁자(9,4) = a low table with two teacups · 창문(12,6) = a window

```
Top-down 3/4 view pixel art game map, classic 16-bit JRPG (RPG Maker) style, 32px tile grid,
orthographic, no perspective distortion, flat soft lighting, clean pixel edges, limited palette.
14 tiles wide by 9 tiles tall (896x576 px, 2x of 448x288).
The living room of a small villa apartment that doubles as a piano lesson studio, at night with the lights off, dim moonlight from the window.
Solid boundary around the edges (walls indoors; fences, buildings or rock edges outdoors). Objects (tile x,y counted from the top-left, 0-based):
- an upright piano at tile 2,2 (left)
- a flashlight lying on the floor at tile 3,4 (left)
- a light switch on the wall at tile 12,1 (top right)
- a low table with two teacups at tile 9,4 (center)
- a window at tile 12,6 (right)
- an open doorway in the bottom wall (tile 6,8) leading to the hall area
- an open doorway in the left wall (tile 0,4) leading to the bedroom area
Leave the rest of the floor clear and walkable.
warm amber and dark brown palette, tense mood.
No people, no characters, no animals, no bodies, no blood, no text, no letters, no numbers, no logos, no watermark.
```

#### 맵 배경 `hall-bg.png` (현관·복도, 14×5칸 → 896×320)

대응: 두꺼비집(1,1) = a circuit breaker box on the wall · 현관 매트(4,3) = an entrance doormat

```
Top-down 3/4 view pixel art game map, classic 16-bit JRPG (RPG Maker) style, 32px tile grid,
orthographic, no perspective distortion, flat soft lighting, clean pixel edges, limited palette.
14 tiles wide by 5 tiles tall (896x320 px, 2x of 448x160).
The entrance and common hallway of a small three-story villa building at night, stairs, fluorescent light.
Solid boundary around the edges (walls indoors; fences, buildings or rock edges outdoors). Objects (tile x,y counted from the top-left, 0-based):
- a circuit breaker box on the wall at tile 1,1 (top left)
- an entrance doormat at tile 4,3 (bottom left)
- an open doorway in the top wall (tile 6,0) leading to the living area
- an open doorway in the bottom wall (tile 12,4) leading to the office area
Keep these floor tiles empty for characters: tile 10,2.
Leave the rest of the floor clear and walkable.
warm amber and dark brown palette, tense mood.
No people, no characters, no animals, no bodies, no blood, no text, no letters, no numbers, no logos, no watermark.
```

#### 맵 배경 `office-bg.png` (빌라 관리실, 10×5칸 → 640×320)

대응: 

```
Top-down 3/4 view pixel art game map, classic 16-bit JRPG (RPG Maker) style, 32px tile grid,
orthographic, no perspective distortion, flat soft lighting, clean pixel edges, limited palette.
10 tiles wide by 5 tiles tall (640x320 px, 2x of 320x160).
A small building manager's office on the ground floor, night.
Solid boundary around the edges (walls indoors; fences, buildings or rock edges outdoors). Objects (tile x,y counted from the top-left, 0-based):
- an open doorway in the top wall (tile 1,0) leading to the hall area
Keep these floor tiles empty for characters: tile 5,3.
Leave the rest of the floor clear and walkable.
warm amber and dark brown palette, tense mood.
No people, no characters, no animals, no bodies, no blood, no text, no letters, no numbers, no logos, no watermark.
```

#### 맵 배경 `bedroom-bg.png` (302호 안방, 8×6칸 → 512×384)

대응: 화장대(2,1) = a dressing table

```
Top-down 3/4 view pixel art game map, classic 16-bit JRPG (RPG Maker) style, 32px tile grid,
orthographic, no perspective distortion, flat soft lighting, clean pixel edges, limited palette.
8 tiles wide by 6 tiles tall (512x384 px, 2x of 256x192).
The main bedroom of the same apartment, at night, dim.
Solid boundary around the edges (walls indoors; fences, buildings or rock edges outdoors). Objects (tile x,y counted from the top-left, 0-based):
- a dressing table at tile 2,1 (top left)
- an open doorway in the right wall (tile 7,3) leading to the living area
Leave the rest of the floor clear and walkable.
warm amber and dark brown palette, tense mood.
No people, no characters, no animals, no bodies, no blood, no text, no letters, no numbers, no logos, no watermark.
```

#### 단서 그림 `light-switch.png` (단서 '켜져 있는 전등 스위치', 960×640)

alt: 거실 벽의 전등 스위치 사진. 스위치가 켜짐 쪽에 올라가 있다. (2026-11-24 적용, 힌트 스타일 블록을 따름)

```
Pixel art evidence image for a detective game, 16-bit style, 3:2, 960x640,
looks like a case file photo, clear readable composition, limited palette, clean pixel edges.
Close-up of a light switch on a living room wall in an old apartment. The toggle is clearly flipped UP to the ON position,
but the whole room around it is completely dark, lit only by a narrow flashlight beam from the side.
No readable text, no letters, no numbers, no logos, no watermark, no blood, no gore, no visible faces.
```

## 3. 캐릭터

탐정 캐릭터 2종·NPC 프롬프트는 [CHARACTER_PROMPTS.md](CHARACTER_PROMPTS.md)로 옮겼다.

## 3. 캐릭터

탐정 캐릭터 2종·NPC 프롬프트는 [CHARACTER_PROMPTS.md](CHARACTER_PROMPTS.md)로 옮겼다.
