import type { Metadata } from 'next';
import { LegalDocument } from '@/components/LegalDocument';
import { t } from '@/i18n/ko';

export const metadata: Metadata = { title: t.legal.privacy };

/** 개인정보처리방침(PRD §1). 문안은 frontend/legal/privacy.md, 출시 전 법률 검토 대상. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10">
      <LegalDocument name="privacy" />
    </main>
  );
}
