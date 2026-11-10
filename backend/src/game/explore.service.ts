import { Injectable } from '@nestjs/common';
import {
  isAdjacent,
  isWalkable,
  type ExploreContent,
  type ExploreState,
  type InspectResponse,
  type MoveResponse,
  type Position,
} from '@mysterytalk/shared';
import { AppException } from '../common/app-exception.js';
import type { Player } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { loadVersion } from './case-data.js';
import { SessionsService } from './sessions.service.js';
import { openMapKeys, unlockZones } from './zones.js';

/**
 * 이동 거리 검증(SPEC §9.2): 직전 저장 위치에서 '경과 시간 × 속도 + 여유' 칸 넘게 움직였으면 거부한다.
 * 완전한 치트 방지가 목표는 아니고, 벽 통과·순간 이동 같은 명백한 조작만 막는다.
 */
const TILES_PER_SECOND = 12; // 화면은 0.11초마다 한 칸(초당 약 9칸)이라 여유를 둔다
const SLACK_TILES = 6;

/** 현장 조사(SPEC §9.2, PRD §6): 진행 상태·이동·조사. 조사·이동은 같은 요청을 다시 보내도 결과가 같다. */
@Injectable()
export class ExploreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
  ) {}

  private async context(player: Player, sessionId: string) {
    const s = await this.sessions.loadOwned(player, sessionId);
    const data = await loadVersion(this.prisma, s.case.id, s.case.currentVersion);
    if (!data.explore) throw new AppException(404, 'NOT_FOUND');
    const e = data.explore;
    const [zones, clues] = await Promise.all([
      this.prisma.sessionZone.findMany({ where: { sessionId: s.id }, select: { mapKey: true } }),
      this.prisma.sessionClue.findMany({ where: { sessionId: s.id }, select: { clueKey: true } }),
    ]);
    const open = openMapKeys(
      e,
      zones.map((z) => z.mapKey),
    );
    const found = new Set(clues.map((c) => c.clueKey));
    // 저장 위치가 없거나(처음) 사건 수정으로 더는 설 수 없는 칸이면 시작 위치로(D59)
    const saved: Position | null =
      s.currentMap !== null && s.posX !== null && s.posY !== null
        ? { map: s.currentMap, x: s.posX, y: s.posY }
        : null;
    const valid = saved && open.has(saved.map) && isWalkable(e, saved.map, saved);
    const position: Position = valid ? saved : { map: e.maps[0]!.key, ...e.spawn };
    // 이동 거리 기준 시각: 마지막 저장 시각, 저장한 적이 없거나 위치를 초기화했으면 세션 시작 시각
    const savedAt = (valid ? s.posSavedAt : null) ?? s.startedAt;
    return { s, e, open, found, position, savedAt };
  }

  async state(player: Player, sessionId: string): Promise<ExploreState> {
    const { e, open, found, position } = await this.context(player, sessionId);
    return {
      position,
      maps: e.maps.map((m) => {
        const unlocked = open.has(m.key);
        return {
          key: m.key,
          name: m.name,
          unlocked,
          grid: unlocked ? m.grid : null,
          exits: unlocked
            ? m.exits.map((x) => ({
                x: x.x,
                y: x.y,
                to: x.to,
                toX: x.toX,
                toY: x.toY,
                toName: e.maps.find((t) => t.key === x.to)!.name,
                locked: !open.has(x.to),
              }))
            : [],
          objects: unlocked
            ? e.objects
                .filter((o) => o.map === m.key)
                .map((o) => ({
                  key: o.key,
                  name: o.name,
                  x: o.x,
                  y: o.y,
                  inspected: o.clue ? found.has(o.clue) : false,
                }))
            : [],
          npcs: unlocked
            ? e.npcs
                .filter((n) => n.map === m.key)
                .map((n) => ({
                  key: n.key,
                  name: n.name,
                  x: n.x,
                  y: n.y,
                  talked: found.has(n.clue),
                }))
            : [],
        };
      }),
      clues: e.clues
        .filter((c) => found.has(c.key))
        .map((c) => ({ key: c.key, kind: c.kind, title: c.title, content: c.content })),
    };
  }

  async move(player: Player, sessionId: string, to: Position): Promise<MoveResponse> {
    const ctx = await this.context(player, sessionId);
    if (ctx.s.status !== 'ACTIVE') throw new AppException(409, 'SESSION_FINISHED');
    const position = this.validateMove(ctx, to);
    await this.save(ctx.s.id, position);
    return { position };
  }

  async inspect(
    player: Player,
    sessionId: string,
    at: Position,
    target: string,
  ): Promise<InspectResponse> {
    const ctx = await this.context(player, sessionId);
    if (ctx.s.status !== 'ACTIVE') throw new AppException(409, 'SESSION_FINISHED');
    if (at.map !== ctx.position.map) throw new AppException(409, 'INVALID_MOVE');
    const position = this.validateMove(ctx, at);
    const obj = ctx.e.objects.find((o) => o.key === target && o.map === position.map);
    const npc = ctx.e.npcs.find((n) => n.key === target && n.map === position.map);
    const thing = obj ?? npc;
    if (!thing) throw new AppException(404, 'NOT_FOUND');
    if (!isAdjacent(position, thing)) throw new AppException(409, 'INVALID_MOVE');

    const clue = ctx.e.clues.find((c) => c.key === thing.clue) ?? null;
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.playSession.update({
        where: { id: ctx.s.id },
        data: {
          currentMap: position.map,
          posX: position.x,
          posY: position.y,
          posSavedAt: new Date(),
          lastActiveAt: new Date(),
        },
      });
      if (!clue) return { newClue: false, unlockedMaps: [] as string[] };
      const inserted = await tx.sessionClue.createMany({
        data: [{ sessionId: ctx.s.id, clueKey: clue.key }],
        skipDuplicates: true,
      });
      const newClue = inserted.count > 0;
      const unlockedMaps = newClue
        ? await unlockZones(tx, ctx.s.id, ctx.e, { kind: 'CLUE', clue: clue.key })
        : [];
      return { newClue, unlockedMaps };
    });
    return {
      kind: obj ? 'OBJECT' : 'NPC',
      name: thing.name,
      description: obj ? obj.description : null,
      lines: npc ? npc.lines : null,
      // 미끼 여부는 엔딩에서만 공개한다.
      clue: clue
        ? { key: clue.key, kind: clue.kind, title: clue.title, content: clue.content }
        : null,
      ...result,
    };
  }

  /**
   * 같은 맵: 설 수 있는 칸이고 이동 거리가 허용 범위 안이어야 한다.
   * 다른 맵: 현재 맵의 출입구를 통해서만 들어갈 수 있고, 대상 맵이 열려 있어야 한다(닫혀 있으면 ZONE_LOCKED).
   */
  private validateMove(
    ctx: { e: ExploreContent; open: Set<string>; position: Position; savedAt: Date },
    to: Position,
  ): Position {
    const { e, open, position: from } = ctx;
    const elapsed = (Date.now() - ctx.savedAt.getTime()) / 1000;
    const allowed = SLACK_TILES + elapsed * TILES_PER_SECOND;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

    if (to.map === from.map) {
      if (!isWalkable(e, to.map, to) || dist(from, to) > allowed) {
        throw new AppException(409, 'INVALID_MOVE');
      }
      return to;
    }
    const map = e.maps.find((m) => m.key === from.map)!;
    const exit = map.exits.find((x) => x.to === to.map && x.toX === to.x && x.toY === to.y);
    if (!exit || dist(from, exit) > allowed) throw new AppException(409, 'INVALID_MOVE');
    if (!open.has(to.map)) throw new AppException(409, 'ZONE_LOCKED');
    return to;
  }

  private async save(sessionId: string, p: Position): Promise<void> {
    await this.prisma.playSession.update({
      where: { id: sessionId },
      data: {
        currentMap: p.map,
        posX: p.x,
        posY: p.y,
        posSavedAt: new Date(),
        lastActiveAt: new Date(),
      },
    });
  }
}
