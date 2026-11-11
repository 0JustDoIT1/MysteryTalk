'use client';

import { useCallback } from 'react';
import { useDeviceStore } from '@/stores/device';
import { playSfx, type SfxKind } from './sfx';

/** 기기의 효과음 볼륨으로 효과음을 낸다. */
export function useSfx(): (kind: SfxKind) => void {
  const volume = useDeviceStore((s) => s.sfx);
  return useCallback((kind: SfxKind) => playSfx(kind, volume), [volume]);
}
