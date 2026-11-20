import Link from 'next/link';

const WIDTH = { sm: 'max-w-xl', md: 'max-w-2xl', lg: 'max-w-3xl' } as const;

/**
 * 책상 위에 서류 한 장을 놓는 공통 틀(2026-11-20 디자인). 뒤로 가기 링크는 책상 위, 내용은 종이 위.
 * 제목이 있으면 종이 맨 위에 밑줄 제목으로 둔다(없으면 내용 쪽에서 h1을 둔다).
 */
export function PageSheet({
  back,
  title,
  width = 'lg',
  children,
}: {
  back?: { href: string; label: string };
  title?: string;
  width?: keyof typeof WIDTH;
  children: React.ReactNode;
}) {
  return (
    <main className={`mx-auto flex w-full ${WIDTH[width]} flex-col gap-3 px-4 py-8 sm:py-10`}>
      {back && (
        <Link href={back.href} className="back-link w-fit">
          ← {back.label}
        </Link>
      )}
      <div className="paper flex min-w-0 flex-col gap-5 p-5 sm:p-8">
        {title && (
          <h1 className="border-b-2 border-ink/70 pb-2 text-2xl font-bold text-ink">{title}</h1>
        )}
        {children}
      </div>
    </main>
  );
}
