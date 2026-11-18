import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  askQuestionRequestSchema,
  inspectRequestSchema,
  moveRequestSchema,
  type ExploreState,
  type InspectRequest,
  type InspectResponse,
  type MoveRequest,
  type MoveResponse,
  type ViewHintResponse,
  memoRequestSchema,
  submitAnswerRequestSchema,
  type Ending,
  type MemoRequest,
  type SubmitAnswerRequest,
  type SubmitAnswerResponse,
  questionLabelSchema,
  type AskQuestionRequest,
  type AskQuestionResponse,
  type CaseDetail,
  type CaseSummary,
  type CreateSessionResponse,
  type QuestionLabel,
  type QuestionLogItem,
  type SessionState,
} from '@mysterytalk/shared';
import { z } from 'zod';
import type { Player } from '../generated/prisma/client.js';
import { CurrentPlayer } from '../player/current-player.decorator.js';
import { PlayerGuard } from '../player/player.guard.js';
import { CasesService } from './cases.service.js';
import { ExploreService } from './explore.service.js';
import { QuestionsService } from './questions.service.js';
import { SessionsService } from './sessions.service.js';
import { SubmissionsService } from './submissions.service.js';

const hintNoSchema = z.coerce.number().int().min(1).max(3);
const clueKeySchema = z.string().regex(/^[a-z0-9-]+$/);

@Controller()
@UseGuards(PlayerGuard)
export class GameController {
  constructor(
    private readonly cases: CasesService,
    private readonly sessions: SessionsService,
    private readonly questions: QuestionsService,
    private readonly submissions: SubmissionsService,
    private readonly explore: ExploreService,
  ) {}

  @Get('cases')
  listCases(@CurrentPlayer() player: Player): Promise<CaseSummary[]> {
    return this.cases.list(player);
  }

  @Get('cases/:slug')
  caseDetail(@Param('slug') slug: string): Promise<CaseDetail> {
    return this.cases.detail(slug);
  }

  @Get('cases/:slug/cover')
  async caseCover(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return imageFile(res, await this.cases.cover(slug));
  }

  @Post('cases/:slug/sessions')
  createSession(
    @CurrentPlayer() player: Player,
    @Param('slug') slug: string,
  ): Promise<CreateSessionResponse> {
    return this.cases.createSession(player, slug);
  }

  @Get('sessions/:id')
  sessionState(@CurrentPlayer() player: Player, @Param('id') id: string): Promise<SessionState> {
    return this.sessions.state(player, id);
  }

  @Get('sessions/:id/questions')
  questionLog(
    @CurrentPlayer() player: Player,
    @Param('id') id: string,
    @Query('label', { schema: questionLabelSchema.optional() }) label?: QuestionLabel,
  ): Promise<QuestionLogItem[]> {
    return this.sessions.questions(player, id, label);
  }

  /** 질문 판정. 헤더 Idempotency-Key(uuid) 필수(SPEC §5). */
  @Post('sessions/:id/questions')
  @HttpCode(200)
  ask(
    @CurrentPlayer() player: Player,
    @Ip() ip: string,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body({ schema: askQuestionRequestSchema }) body: AskQuestionRequest,
  ): Promise<AskQuestionResponse> {
    return this.questions.ask(player, id, key, body.question, ip);
  }

  /** 힌트 열람(해금된 것만, 순서대로). 같은 힌트를 다시 요청하면 같은 내용(감점 1회). */
  @Post('sessions/:id/hints/:no')
  @HttpCode(200)
  viewHint(
    @CurrentPlayer() player: Player,
    @Param('id') id: string,
    @Param('no', { schema: hintNoSchema }) no: number,
  ): Promise<ViewHintResponse> {
    return this.sessions.viewHint(player, id, no);
  }

  /** 열람한 이미지 힌트의 이미지(D92·D93). 열람 전·남의 세션은 404 */
  @Get('sessions/:id/hints/:no/image')
  async hintImage(
    @CurrentPlayer() player: Player,
    @Param('id') id: string,
    @Param('no', { schema: hintNoSchema }) no: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return imageFile(res, await this.sessions.hintImage(player, id, no));
  }

  @Put('sessions/:id/memo')
  saveMemo(
    @CurrentPlayer() player: Player,
    @Param('id') id: string,
    @Body({ schema: memoRequestSchema }) body: MemoRequest,
  ): Promise<{ memo: string }> {
    return this.sessions.saveMemo(player, id, body.memo);
  }

  /** 정답 제출. 헤더 Idempotency-Key(uuid) 필수(SPEC §5, §7). */
  @Post('sessions/:id/submissions')
  @HttpCode(200)
  submit(
    @CurrentPlayer() player: Player,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body({ schema: submitAnswerRequestSchema }) body: SubmitAnswerRequest,
  ): Promise<SubmitAnswerResponse> {
    return this.submissions.submit(player, id, key, body.answer);
  }

  /** 수사 포기 → F(PRD D80). 이미 포기한 세션은 그대로 성공. */
  @Post('sessions/:id/abandon')
  @HttpCode(200)
  abandon(
    @CurrentPlayer() player: Player,
    @Param('id') id: string,
  ): Promise<{ status: 'ABANDONED' }> {
    return this.sessions.abandon(player, id);
  }

  @Get('sessions/:id/ending')
  ending(@CurrentPlayer() player: Player, @Param('id') id: string): Promise<Ending> {
    return this.sessions.ending(player, id);
  }

  /** 현장 조사 상태(맵·위치·얻은 단서) */
  @Get('sessions/:id/explore')
  exploreState(@CurrentPlayer() player: Player, @Param('id') id: string): Promise<ExploreState> {
    return this.explore.state(player, id);
  }

  /** 위치 저장·맵 이동(출입구). 같은 요청을 다시 보내도 결과가 같다. */
  @Post('sessions/:id/move')
  @HttpCode(200)
  move(
    @CurrentPlayer() player: Player,
    @Param('id') id: string,
    @Body({ schema: moveRequestSchema }) body: MoveRequest,
  ): Promise<MoveResponse> {
    return this.explore.move(player, id, body);
  }

  /** 조사·대화(인접한 대상만). 처음이면 단서 획득, 다시 조사하면 newClue=false. */
  @Post('sessions/:id/inspect')
  @HttpCode(200)
  inspect(
    @CurrentPlayer() player: Player,
    @Param('id') id: string,
    @Body({ schema: inspectRequestSchema }) body: InspectRequest,
  ): Promise<InspectResponse> {
    return this.explore.inspect(player, id, { map: body.map, x: body.x, y: body.y }, body.target);
  }

  /** 열린 맵의 배경 그림(D94). 닫힌 맵·남의 세션은 404 */
  @Get('sessions/:id/maps/:key/background')
  async mapBackground(
    @CurrentPlayer() player: Player,
    @Param('id') id: string,
    @Param('key', { schema: clueKeySchema }) key: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return imageFile(res, await this.explore.mapBackground(player, id, key));
  }

  /** 얻은 단서의 이미지(D93). 얻기 전·남의 세션은 404 */
  @Get('sessions/:id/clues/:key/image')
  async clueImage(
    @CurrentPlayer() player: Player,
    @Param('id') id: string,
    @Param('key', { schema: clueKeySchema }) key: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return imageFile(res, await this.explore.clueImage(player, id, key));
  }
}

/** 이미지 응답: 본인 브라우저에만 캐시(공유 캐시 금지), 형식 추측 금지 */
function imageFile(res: Response, img: { mime: string; bytes: Uint8Array }): StreamableFile {
  res.set({
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  return new StreamableFile(Buffer.from(img.bytes), { type: img.mime });
}
