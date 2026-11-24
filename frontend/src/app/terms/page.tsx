import type { Metadata } from 'next';
import { LegalDocument } from '@/components/LegalDocument';
import { PageSheet } from '@/components/PageSheet';
import { t } from '@/i18n/ko';

export const metadata: Metadata = { title: t.legal.terms };

/** 이용약관(PRD §1). 문안은 frontend/legal/terms.md, 공개 전 법규 확인 대상. */
export default function TermsPage() {
  return (
    <PageSheet width="md">
      <LegalDocument name="terms" />
    </PageSheet>
  );
}
