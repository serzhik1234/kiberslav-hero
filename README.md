# Киберслав: герой-копейщик (three.js-прототип)

Процедурная низкополигональная модель героя для 3D-рогалика в стиле славянского киберпанка:
плазменное копьё, кибер-рука, тело с рубахой, ушанкой, поясом с батареями, наколенниками и лаптями.
Всё строится кодом (three.js r128), текстуры — пиксельные DataTexture 8–64 px, генерируются тоже кодом.

![этап 2](docs/hero_stage2.png)

## Быстрый старт

Откройте `dist/index.html` в браузере — это готовая самодостаточная страница (three.js грузится с cdnjs).

Управление: мышь — вращение камеры, колесо — зум; кнопки и клавиши действий копья и руки — на панели страницы.

## Структура

```
src/            исходники по частям (склеиваются в одну страницу)
  head.html     <head>, стили
  body.html     панель управления
  world1.js     помощники, текстуры, сцена, модель копья
  world2.js     кибер-рука: модель, риг, кабель
  world2b.js    тело героя: лофт/скошенные боксы, скелет, одежда, голова, ноги, правая рука, Grip
  world3.js     состояние, IK, анимационный шаг, API
  ui.js         рендерер, ввод, UI
dist/index.html собранная страница
build.sh        сборка src → dist + проверка синтаксиса (нужен Node.js)
tools/render/   рендер без браузера (node + headless-gl) для листов рендеров
docs/           листы рендеров
```

Правьте файлы в `src/`, затем `./build.sh`.

## Иерархия (пивоты для анимации)

```
ArmPivot > ArmFrame > Hips > Spine > Chest > Neck > Head > HeadMesh > (Face, Beard, Ushanka)
Chest > RightShoulder > RightUpperArm > RightForearm > RightHand > RightFist > RightThumb
Chest > Shoulder > UpperArm > Forearm > Hand > Finger1..4_1..3, Thumb_1..2, Grip > Spear
Hips > Left/RightUpLeg > Left/RightLeg > Left/RightFoot
SpearRoot > yaw > tilt > SpearTarget   (невидимый контроллер: к нему тянется IK кибер-руки)
```

Оси внутри ArmFrame: +X — левая (кибер) сторона героя, +Y вверх, +Z вперёд.

## Рендер без браузера (Linux)

```
cd tools/render
npm install            # three@0.128.0, gl@8 (нужны build-essential, libxi-dev, libglu1-mesa-dev)
mkdir -p out
xvfb-run -a node render.js "$(cat jobs/stage2.json)"
python3 topng.py out/n1 out/n2 out/n3 out/n4      # нужен Pillow
```

Описание кадра в JSON: `out`, `arm`, `plasma`, `tier`, `armAct`, `act`, `t` (секунды), `cam` {theta, phi, r, tx, ty, tz}.

## Статус

- [x] Копьё, кибер-рука, анимации копья и руки
- [x] Этап 1: пропорции, хват копья механической рукой
- [x] Этап 2: голова, борода, ушанка, корпус и рубаха
- [ ] Следующие этапы: руки, пояс, ноги; затем анимации тела
- [ ] Перенос в Blender (bpy) → FBX/GLB для Unity
