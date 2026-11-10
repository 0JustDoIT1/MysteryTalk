'use client';

import {
  askQuestionResponseSchema,
  caseDetailSchema,
  caseSummarySchema,
  createSessionResponseSchema,
  endingSchema,
  exploreStateSchema,
  inspectResponseSchema,
  moveResponseSchema,
  viewHintResponseSchema,
  type Position,
  questionLogItemSchema,
  sessionStateSchema,
  submitAnswerResponseSchema,
  type QuestionLabel,
} from '@mysterytalk/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiOrThrow } from './client';

/**
 * 서버 상태(SPEC §12.1): 서버가 원본인 데이터는 TanStack Query 캐시에만 둔다.
 * 상태를 바꾸는 요청은 mutation 으로만 보내고, 성공하면 관련 쿼리를 다시 받는다.
 * 질문·제출은 자동 재시도를 끄고, 사용자가 다시 누를 때 같은 멱등성 키로 보낸다.
 */
export const keys = {
  cases: ['cases'] as const,
  caseDetail: (slug: string) => ['cases', slug] as const,
  session: (id: string) => ['sessions', id] as const,
  questions: (id: string, label?: QuestionLabel) =>
    ['sessions', id, 'questions', label ?? 'ALL'] as const,
  ending: (id: string) => ['sessions', id, 'ending'] as const,
  explore: (id: string) => ['sessions', id, 'explore'] as const,
};

export function useCases() {
  return useQuery({
    queryKey: keys.cases,
    queryFn: () => apiOrThrow('/cases', z.array(caseSummarySchema)),
  });
}

export function useCaseDetail(slug: string) {
  return useQuery({
    queryKey: keys.caseDetail(slug),
    queryFn: () => apiOrThrow(`/cases/${encodeURIComponent(slug)}`, caseDetailSchema),
    enabled: slug.length > 0,
  });
}

export function useSessionState(id: string) {
  return useQuery({
    queryKey: keys.session(id),
    queryFn: () => apiOrThrow(`/sessions/${id}`, sessionStateSchema),
  });
}

export function useQuestionLog(id: string, label?: QuestionLabel) {
  return useQuery({
    queryKey: keys.questions(id, label),
    queryFn: () =>
      apiOrThrow(
        `/sessions/${id}/questions${label ? `?label=${label}` : ''}`,
        z.array(questionLogItemSchema),
      ),
  });
}

export function useEnding(id: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.ending(id),
    queryFn: () => apiOrThrow(`/sessions/${id}/ending`, endingSchema),
    enabled,
  });
}

export function useStartSession(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiOrThrow(`/cases/${encodeURIComponent(slug)}/sessions`, createSessionResponseSchema, {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.cases }),
  });
}

/** 세션과 관련된 서버 상태를 모두 다시 받는다(진행 수치·힌트·기록·목록). */
function useRefreshSession(id: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['sessions', id] }),
      qc.invalidateQueries({ queryKey: keys.cases }),
    ]);
}

export function useAskQuestion(id: string) {
  const refresh = useRefreshSession(id);
  return useMutation({
    retry: false,
    mutationFn: (v: { question: string; key: string }) =>
      apiOrThrow(`/sessions/${id}/questions`, askQuestionResponseSchema, {
        method: 'POST',
        body: { question: v.question },
        idempotencyKey: v.key,
      }),
    onSuccess: refresh,
  });
}

export function useViewHint(id: string) {
  const refresh = useRefreshSession(id);
  return useMutation({
    mutationFn: (no: number) =>
      apiOrThrow(`/sessions/${id}/hints/${no}`, viewHintResponseSchema, { method: 'POST' }),
    onSuccess: refresh,
  });
}

export function useSaveMemo(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memo: string) =>
      apiOrThrow(`/sessions/${id}/memo`, z.object({ memo: z.string() }), {
        method: 'PUT',
        body: { memo },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.session(id) }),
  });
}

export function useSubmitAnswer(id: string) {
  const refresh = useRefreshSession(id);
  return useMutation({
    retry: false,
    mutationFn: (v: { answer: string; key: string }) =>
      apiOrThrow(`/sessions/${id}/submissions`, submitAnswerResponseSchema, {
        method: 'POST',
        body: { answer: v.answer },
        idempotencyKey: v.key,
      }),
    onSuccess: refresh,
  });
}

export function useAbandon(id: string) {
  const refresh = useRefreshSession(id);
  return useMutation({
    mutationFn: () =>
      apiOrThrow(`/sessions/${id}/abandon`, z.object({ status: z.literal('ABANDONED') }), {
        method: 'POST',
      }),
    onSuccess: refresh,
  });
}

export function useExploreState(id: string) {
  return useQuery({
    queryKey: keys.explore(id),
    queryFn: () => apiOrThrow(`/sessions/${id}/explore`, exploreStateSchema),
  });
}

/** 위치 저장·맵 이동. 결과 위치는 현장 조사 화면이 직접 반영한다. */
export function useMove(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (to: Position) =>
      apiOrThrow(`/sessions/${id}/move`, moveResponseSchema, { method: 'POST', body: to }),
    onSuccess: (_r, to) => {
      // 다른 맵으로 옮겼을 때만 맵 정보를 다시 받는다(주기 저장은 다시 받지 않음).
      const current = qc.getQueryData<{ position: Position }>(keys.explore(id));
      if (current && current.position.map !== to.map) {
        void qc.invalidateQueries({ queryKey: keys.explore(id) });
      }
    },
  });
}

export function useInspect(id: string) {
  const refresh = useRefreshSession(id);
  return useMutation({
    mutationFn: (v: Position & { target: string }) =>
      apiOrThrow(`/sessions/${id}/inspect`, inspectResponseSchema, { method: 'POST', body: v }),
    onSuccess: refresh,
  });
}
