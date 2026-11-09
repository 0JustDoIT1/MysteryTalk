import { FoundationStatus } from '@/components/FoundationStatus';

// 1단계 임시 화면. 18세 확인·메인 메뉴·사건 선택은 이후 단계에서 구현한다(SPEC §12).
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50">
      <h1 className="text-3xl font-bold tracking-tight">MysteryTalk</h1>
      <FoundationStatus />
    </main>
  );
}
