import * as THREE from 'three';
import { HistoryTexture } from './HistoryTexture';

interface SoundHistory {
  buffer: Uint8Array;
  update: () => void;
}

interface VolumeHistory {
  buffer: Uint8Array;
  update: () => void;
}

interface TouchHistory {
  buffer: Uint8Array;
  update: () => void;
}

interface FloatSoundHistory {
  buffer: Float32Array;
  update: () => void;
}

interface Analyser {
  getByteFrequencyData: (array: Uint8Array) => void;
  getFloatFrequencyData: (array: Float32Array) => void;
}

interface HistoryProgramInfo {
  material: THREE.ShaderMaterial;
}

interface QuadBufferInfo {
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
}

export type GlitzState = {
  analyser: Analyser;
  soundHistory: HistoryTexture;
  volumeHistory: HistoryTexture;
  touchHistory: TouchHistory;
  floatSoundHistory?: HistoryTexture;
  historyProgramInfo: HistoryProgramInfo;
  quadBufferInfo: QuadBufferInfo;
  maxSample: number;
  sum: number;
  maxDif: number;
  touchColumns: number;
  time: number;
}



// Assuming s and gl are globally defined
export function updateSoundAndTouchHistory(s: GlitzState): void {
  // Copy audio data to Nx1 texture
  s.analyser.getByteFrequencyData(s.soundHistory.buffer);

  // Calculate max value
  {
    const buf = s.soundHistory.buffer;
    const len = buf.length;
    let max = 0;
    for (let ii = 0; ii < len; ++ii) {
      const v = buf[ii];
      if (v > max) {
        max = v;
      }
    }
    s.volumeHistory.buffer[3] = max;
  }

  s.volumeHistory.buffer[0] = Math.abs(s.maxSample) * 255;
  s.volumeHistory.buffer[1] = s.sum * 255;
  s.volumeHistory.buffer[2] = s.maxDif * 127;

  if (s.floatSoundHistory) {
    s.analyser.getFloatFrequencyData(s.floatSoundHistory.buffer);
  }

  // Update time
  for (let ii = 0; ii < s.touchColumns; ++ii) {
    const offset = ii * 4;
    s.touchHistory.buffer[offset + 3] = s.time;
  }

  // gl.disable(gl.DEPTH_TEST);
  // gl.disable(gl.BLEND);

  // Three.js equivalent of setting buffers and attributes
  const material = s.historyProgramInfo.material;
  const geometry = s.quadBufferInfo.geometry;
  const mesh = s.quadBufferInfo.mesh;

  mesh.geometry = geometry;
  mesh.material = material;


  s.volumeHistory.update();
  s.soundHistory.update();
  if (s.floatSoundHistory) {
    s.floatSoundHistory.update();
  }
  s.touchHistory.update();
}

export function 