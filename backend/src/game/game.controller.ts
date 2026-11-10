import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  askQuestionRequestSchema,
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
import type { Player } from '../generated/prisma/client.js';
import { CurrentPlayer } from '../player/current-player.decorator.js';
import { PlayerGuard } from '../player/player.guard.js';
import { CasesService } from './cases.service.js';
import { QuestionsService } from './questions.service.js';
import { SessionsService } from './sessions.service.js';

@Controller()
@UseGuards(PlayerGuard)
export class GameController {
  constructor(
    private readonly cases: CasesService,
    private readonly sessions: SessionsService,
    private readonly questions: QuestionsService,
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
}
