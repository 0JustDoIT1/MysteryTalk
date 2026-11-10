'use client';

import type { InspectResponse, Position, SessionState } from '@mysterytalk/shared';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ApiError } from '@/lib/api/client';
import { useExploreState, useInspect, useMove } from '@/lib/api/queries';
import { canStand, dirForKey, exitAt, isInteractKey, targetNear, DELTA } from '@/lib/play/explore';
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
  const { live, facing, locked, setLive, send, take, setLocked, reset } = useExploreStore();
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

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!map || !live || !active) return;
    const dir = dirForKey(e.key);
    if (dir) {
      e.preventDefault();
      if (locked || e.timeStamp - lastStep.current < STEP_MS) return;
      lastStep.current = e.timeStamp;
      const next = { map: live.map, x: live.x + DELTA[dir].dx, y: live.y + DELTA[dir].dy };
      if (!canStand(map, next)) {
        setLive(live, dir);
        return;
      }
      setLive(next, dir);
      const exit = exitAt(map, next);
      if (exit) {
        if (exit.locked) pushToast(t.explore.lockedExit(exit.toName));
        else send({ type: 'travel', to: { map: exit.to, x: exit.toX, y: exit.toY } });
      }
      return;
    }
    if (isInteractKey(e.key)) {
      e.preventDefault();
      if (locked) return;
      const target = targetNear(map, live, facing);
      if (target) send({ type: 'inspect', target: target.key, at: live });
    }
  }

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
        <div ref={canvasRef} data-testid="explore-canvas" />
        {!focused && (
          <p className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs text-stone-200/80">
            {t.explore.focusHint}
          </p>
        )}
      </div>
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
