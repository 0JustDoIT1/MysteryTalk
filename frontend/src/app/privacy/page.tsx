import type { Metadata } from 'next';
import { LegalDocument } from '@/components/LegalDocument';
import { PageSheet } from '@/components/PageSheet';
import { t } from '@/i18n/ko';

export const metadata: Metadata = { title: t.legal.privacy };

/** 개인정보처리방침(PRD §1). 문안은 frontend/legal/privacy.md, 공개 전 법규 확인 대상. */
export default function PrivacyPage() {
  return (
    <PageSheet width="md">
      <LegalDocument name="privacy" />
    </PageSheet>
  );
}
