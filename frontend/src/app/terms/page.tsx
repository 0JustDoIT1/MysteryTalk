import { t } from '@/i18n/ko';

/** 자리 페이지: 문안은 출시 전 법률 검토 후 작성한다(PRD §15). */
export default function TermsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="text-xl font-semibold">{t.legal.terms}</h1>
      <p className="text-stone-300">{t.legal.pending}</p>
    </main>
  );
}
