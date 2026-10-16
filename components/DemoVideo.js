'use client';

import { useEffect, useRef } from 'react';

// El demo arranca solo, sin sonido y en loop, salvo que la persona haya pedido
// menos movimiento en su sistema: ahí queda quieto con los controles.
export default function DemoVideo() {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      v.removeAttribute('autoplay');
      v.pause();
    } else {
      v.play().catch(() => {});
    }
  }, []);

  return (
    <div className="phone">
      <video
        ref={ref}
        src="/demo/como-se-juega.mp4"
        poster="/demo/como-se-juega.jpg"
        width="292"
        height="584"
        autoPlay
        muted
        loop
        playsInline
        controls
        preload="metadata"
        aria-label="Demo de una partida: elegir el caso, leer la evidencia de cada rol, interrogar a un sospechoso y responder para avanzar."
      />
    </div>
  );
}
