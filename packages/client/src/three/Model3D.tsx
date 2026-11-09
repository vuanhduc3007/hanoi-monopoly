import { useEffect, useRef, useState, type ReactNode } from 'react';
import type * as THREE from 'three';
import { hasWebGL } from './models';
import { Showcase } from './showcase';

/**
 * Renders one turning 3D model. `make` builds it (called again when `id`
 * changes). Falls back to `fallback` (2D art) without WebGL.
 */
export function Model3D({
  id,
  make,
  height = 1,
  size = 160,
  fallback,
  className = '',
}: {
  id: string;
  make: () => THREE.Object3D;
  height?: number;
  size?: number;
  fallback: ReactNode;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<Showcase | null>(null);
  const [ok, setOk] = useState(() => typeof window !== 'undefined' && hasWebGL());

  useEffect(() => {
    if (!ok || !canvas.current) return;
    try {
      const s = new Showcase(canvas.current);
      s.setSize(size, size);
      s.start();
      stage.current = s;
      return () => {
        s.dispose();
        stage.current = null;
      };
    } catch {
      setOk(false);
    }
  }, [ok, size]);

  useEffect(() => {
    stage.current?.show(make(), height);
    // `make` is a fresh closure each render; `id` says when the model changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, height, ok]);

  if (!ok) return <div className={`model-3d model-fallback ${className}`}>{fallback}</div>;
  return <canvas ref={canvas} className={`model-3d ${className}`} style={{ width: size, height: size }} aria-hidden />;
}
