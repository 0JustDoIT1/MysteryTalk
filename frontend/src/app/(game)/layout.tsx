import { AgeGate } from '@/components/account/AgeGate';
import { DetectiveSetup } from '@/components/account/DetectiveSetup';

/**
 * 게임 화면 묶음(라우트 그룹, 주소에는 나타나지 않는다). 18세 확인과 '탐정 정하기' 창은 여기서만 띄운다.
 * 약관·처리방침(/terms, /privacy)은 그룹 밖이라 확인 전에도, 이용 불가 기기에서도 읽을 수 있다(PRD §1).
 */
export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <AgeGate>
      {children}
      <DetectiveSetup />
    </AgeGate>
  );
}
