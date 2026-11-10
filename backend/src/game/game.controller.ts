import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  askQuestionRequestSchema,
  memoRequestSchema,
  submitAnswerRequestSchema,
  type Ending,
  type HintState,
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
import { QuestionsService } from './questions.service.js';
import { SessionsService } from './sessions.service.js';
import { SubmissionsService } from './submissions.service.js';

const hintNoSchema = z.coerce.number().int().min(1).max(3);

@Controller()
@UseGuards(PlayerGuard)
export class GameController {
  constructor(
    private readonly cases: CasesService,
    private readonly sessions: SessionsService,
    private readonly questions: QuestionsService,
    private readonly submissions: SubmissionsService,
  ) {}

  @Get('cases')
  listCases(@CurrentPlayer() player: Player): Promise<CaseSummary[]> {
    return this.cases.list(player);
  }

  @Get('cases/:slug')
  caseDetail(@Param('slug') slug: string): Promise<CaseDetail> {
    return this.cases.detail(slug);
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
    @Param('id') id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body({ schema: askQuestionRequestSchema }) body: AskQuestionRequest,
  ): Promise<AskQuestionResponse> {
    return this.questions.ask(player, id, key, body.question);
  }

  /** 힌트 열람(해금된 것만, 순서대로). 같은 힌트를 다시 요청하면 같은 내용(감점 1회). */
  @Post('sessions/:id/hints/:no')
  @HttpCode(200)
  viewHint(
    @CurrentPlayer() player: Player,
    @Param('id') id: string,
    @Param('no', { schema: hintNoSchema }) no: number,
  ): Promise<HintState> {
    return this.sessions.viewHint(player, id, no);
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
}
