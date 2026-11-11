'use client';

import type { InspectResponse, Position, SessionState } from '@mysterytalk/shared';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { ApiError } from '@/lib/api/client';
import { useExploreState, useInspect, useMove } from '@/lib/api/queries';
import { useSfx } from '@/lib/audio/use-sfx';
import {
  canStand,
  dirForKey,
  exitAt,
  isInteractKey,
  targetNear,
  DELTA,
  type Dir,
} from '@/lib/play/explore';
import { useExploreStore } from '@/stores/explore';
import { useToastStore } from '@/stores/toast';
import { t } from '@/i18n/ko';
import { Modal } from '../Dialogs';
import { createRenderer, type ExploreRenderer } from './renderer';

/** 같은 키를 누르고 있을 때 한 칸 이동 간격 */
const STEP_MS = 110;
/** 걷는 중 위치 저장 주기(SPEC §9.2) */
const SAVE_MS = 10_000;

/**
 * 현장 조사(SPEC §9.2·§9.3, PRD §6). 이동 판단·API 호출은 여기서, 그리기는 Phaser 렌더러가 한다.
 * 키 입력은 맵에 포커스가 있을 때만 받아 질문 입력과 충돌하지 않는다.
 */
export function ExploreView({ session }: { session: SessionState }) {
  const id = session.sessionId;
  const explore = useExploreState(id);
  const move = useMove(id);
  const inspect = useInspect(id);
  const pushToast = useToastStore((s) => s.push);
  const play = useSfx();
  const { live, facing, setLive, send, take, setLocked, reset } = useExploreStore();
  const command = useExploreStore((s) => s.command);
  const [result, setResult] = useState<InspectResponse | null>(null);
  const [focused, setFocused] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ExploreRenderer | null>(null);
  const lastStep = useRef(0);
  const lastSaved = useRef<Position | null>(null);
  const active = session.status === 'ACTIVE';

  // 서버 위치로 시작(새로고침·재접속 복원, D53)
  useEffect(() => {
    reset();
    return reset;
  }, [id, reset]);
  useEffect(() => {
    if (explore.data && !live) {
      setLive(explore.data.position);
      lastSaved.current = explore.data.position;
    }
  }, [explore.data, live, setLive]);

  const map = explore.data?.maps.find((m) => m.key === live?.map && m.unlocked) ?? null;

  // Phaser 렌더러 생성·정리
  useEffect(() => {
    let disposed = false;
    if (!canvasRef.current) return;
    void createRenderer(canvasRef.current).then((r) => {
      if (disposed) r.destroy();
      else rendererRef.current = r;
    });
    return () => {
      disposed = true;
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (map && live) rendererRef.current?.draw(map, live, facing);
    // 렌더러가 늦게 준비되는 경우를 위해 한 번 더 그린다.
    const timer = setTimeout(() => {
      if (map && live) rendererRef.current?.draw(map, live, facing);
    }, 300);
    return () => clearTimeout(timer);
  }, [map, live, facing]);

  // Phaser·키 입력이 넣은 명령을 처리한다(조사·맵 이동).
  useEffect(() => {
    if (!command) return;
    const c = take();
    if (!c) return;
    if (c.type === 'travel') {
      setLocked(true);
      move.mutate(c.to, {
        onSuccess: ({ position }) => {
          setLive(position);
          lastSaved.current = position;
        },
        onError: (error) => handleMoveError(error),
        onSettled: () => setLocked(false),
      });
    } else {
      setLocked(true);
      inspect.mutate(
        { ...c.at, target: c.target },
        {
          onSuccess: (r) => {
            if (r.newClue) play('clue');
            if (r.unlockedMaps.length) play('unlock');
            lastSaved.current = c.at;
            setResult(r);
            if (r.unlockedMaps.length) pushToast(t.explore.unlocked(r.unlockedMaps));
          },
          onError: (error) => {
            setLocked(false);
            handleMoveError(error);
          },
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

  function handleMoveError(error: unknown) {
    if (error instanceof ApiError) pushToast(error.message);
    // 서버 위치로 다시 맞춘다.
    void explore.refetch().then((r) => {
      if (r.data) {
        setLive(r.data.position);
        lastSaved.current = r.data.position;
      }
    });
  }

  // 걷는 중 주기적으로 위치 저장(같은 맵 안에서 움직였을 때만)
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      const p = useExploreStore.getState().live;
      const saved = lastSaved.current;
      if (!p || !saved || p.map !== saved.map || (p.x === saved.x && p.y === saved.y)) return;
      if (useExploreStore.getState().locked) return;
      move.mutate(p, { onSuccess: () => (lastSaved.current = p), onError: handleMoveError });
    }, SAVE_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // 버튼을 누르고 있는 동안에도 최신 상태를 읽도록 맵은 ref 로 둔다.
  const mapRef = useRef(map);
  mapRef.current = map;

  /** 한 칸 이동(키보드·가상 방향키 공용). 출입구에 들어서면 맵 이동을 요청한다. */
  function step(dir: Dir) {
    const m = mapRef.current;
    const { live: here, locked: busy } = useExploreStore.getState();
    if (!m || !here || !active || busy) return;
    const next = { map: here.map, x: here.x + DELTA[dir].dx, y: here.y + DELTA[dir].dy };
    if (!canStand(m, next)) {
      setLive(here, dir);
      return;
    }
    setLive(next, dir);
    const exit = exitAt(m, next);
    if (exit) {
      if (exit.locked) pushToast(t.explore.lockedExit(exit.toName));
      else send({ type: 'travel', to: { map: exit.to, x: exit.toX, y: exit.toY } });
    }
  }

  /** 바라보는 쪽(없으면 붙어 있는) 대상을 조사 */
  function interact() {
    const m = mapRef.current;
    const { live: here, facing: dir, locked: busy } = useExploreStore.getState();
    if (!m || !here || !active || busy) return;
    const target = targetNear(m, here, dir);
    if (target) send({ type: 'inspect', target: target.key, at: here });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const dir = dirForKey(e.key);
    if (dir) {
      e.preventDefault();
      if (e.timeStamp - lastStep.current < STEP_MS) return;
      lastStep.current = e.timeStamp;
      step(dir);
      return;
    }
    if (isInteractKey(e.key)) {
      e.preventDefault();
      interact();
    }
  }

  // 가상 방향키: 누르고 있으면 계속 이동(PRD D42)
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopHold = () => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
  };
  useEffect(() => stopHold, []);
  const holdProps = (dir: Dir) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      stopHold();
      step(dir);
      holdTimer.current = setInterval(() => step(dir), 160);
    },
    onPointerUp: stopHold,
    onPointerLeave: stopHold,
    onPointerCancel: stopHold,
    onContextMenu: (e: MouseEvent<HTMLButtonElement>) => e.preventDefault(),
  });

  if (explore.error)
    return (
      <p className="text-sm text-stone-400">
        {explore.error instanceof ApiError && explore.error.code === 'NOT_FOUND'
          ? t.explore.unavailable
          : explore.error.message}
      </p>
    );

  const target = map && live ? targetNear(map, live, facing) : null;

  return (
    <section aria-labelledby="explore-heading" className="flex flex-col gap-2">
      <h2 id="explore-heading" className="font-semibold text-amber-100">
        {t.explore.heading}
      </h2>
      <div
        ref={boxRef}
        role="application"
        aria-label={t.explore.heading}
        aria-describedby="explore-help"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`relative w-fit max-w-full overflow-auto rounded border-2 ${focused ? 'border-amber-300' : 'border-stone-700'}`}
      >
        <div
          ref={canvasRef}
          data-testid="explore-canvas"
          className="[&_canvas]:!h-auto [&_canvas]:!max-w-full"
        />
        {!focused && (
          <p className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs text-stone-200/80">
            {t.explore.focusHint}
          </p>
        )}
      </div>
      {active && (
        <div
          role="group"
          aria-label={t.explore.pad}
          className="flex items-center gap-4 select-none lg:hidden pointer-coarse:flex"
        >
          <div className="grid grid-cols-3 grid-rows-3 gap-1">
            {(
              [
                ['up', '▲', 'col-start-2 row-start-1'],
                ['left', '◀', 'col-start-1 row-start-2'],
                ['right', '▶', 'col-start-3 row-start-2'],
                ['down', '▼', 'col-start-2 row-start-3'],
              ] as const
            ).map(([dir, icon, pos]) => (
              <button
                key={dir}
                type="button"
                aria-label={t.explore[dir]}
                {...holdProps(dir)}
                className={`${pos} h-12 w-12 touch-none rounded bg-stone-700 text-lg text-stone-100 active:bg-stone-500`}
              >
                {icon}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={interact}
            className="h-14 w-20 rounded-full bg-amber-300 font-semibold text-stone-900 active:bg-amber-200"
          >
            {t.explore.interact}
          </button>
        </div>
      )}
      <p id="explore-help" className="text-xs text-stone-400">
        {t.explore.help}
      </p>
      <p aria-live="polite" className="text-sm text-stone-300">
        {map && <span>{t.explore.here(map.name)}</span>}
        {target && (
          <span className="ml-3 text-amber-200">
            {target.kind === 'NPC' ? t.explore.talk(target.name) : t.explore.near(target.name)}
          </span>
        )}
      </p>

      <Modal
        open={result !== null}
        onClose={() => {
          setResult(null);
          setLocked(false);
          boxRef.current?.focus();
        }}
        labelledBy="inspect-heading"
      >
        {result && (
          <div className="flex flex-col gap-3">
            <h2 id="inspect-heading" className="text-lg font-semibold text-amber-200">
              {result.name}
            </h2>
            {result.description && <p className="text-stone-200">{result.description}</p>}
            {result.lines?.map((line) => (
              <p key={line} className="text-stone-200">
                “{line}”
              </p>
            ))}
            {result.clue && result.newClue && (
              <div className="rounded border border-emerald-500/50 bg-emerald-950/50 p-3 text-sm">
                <p className="font-semibold text-emerald-200">
                  {t.explore.clueFound}: {result.clue.title}
                </p>
                <p className="text-emerald-50">{result.clue.content}</p>
              </div>
            )}
            {result.clue && !result.newClue && (
              <p className="text-sm text-stone-400">{t.explore.alreadyInspected}</p>
            )}
            {!result.clue && result.kind === 'OBJECT' && (
              <p className="text-sm text-stone-400">{t.explore.noClue}</p>
            )}
            <form method="dialog" className="flex justify-end">
              <button
                type="submit"
                autoFocus
                className="rounded bg-amber-300 px-4 py-2 font-semibold text-stone-900"
              >
                {t.common.close}
              </button>
            </form>
          </div>
        )}
      </Modal>
    </section>
  );
}
