import type { Metadata } from 'next';
import { LegalDocument } from '@/components/LegalDocument';
import { t } from '@/i18n/ko';

export const metadata: Metadata = { title: t.legal.terms };

/** 이용약관(PRD §1). 문안은 frontend/legal/terms.md, 출시 전 법률 검토 대상. */
export default function TermsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10">
      <LegalDocument name="terms" />
    </main>
  );
}
