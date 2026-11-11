import { describe, expect, it } from 'vitest';
import { speechSupported, transcriptOf } from './speech';
import { useDeviceStore } from '@/stores/device';

describe('음성 인식 도우미 (PRD D38)', () => {
  it('브라우저가 아니면(서버 렌더) 지원하지 않는 것으로 본다', () => {
    expect(speechSupported()).toBe(false);
  });

  it('인식 결과를 한 문장으로 합치고 앞뒤 공백을 지운다', () => {
    expect(
      transcriptOf({ results: [[{ transcript: ' 열쇠는 ' }], [{ transcript: '어디에' }]] }),
    ).toBe('열쇠는  어디에');
  });
});

describe('기기 볼륨 (PRD D39)', () => {
  it('0~100 사이 정수로 맞춘다', () => {
    const s = useDeviceStore.getState();
    s.setBgm(150);
    s.setSfx(-3);
    expect(useDeviceStore.getState()).toMatchObject({ bgm: 100, sfx: 0 });
    useDeviceStore.getState().setBgm(42.6);
    expect(useDeviceStore.getState().bgm).toBe(43);
  });
});
