'use client';

import dynamic from 'next/dynamic';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-950 text-white">
      {/* <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex mb-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Mapa Interactivo Latam
          </h1>
          <p className="text-gray-400">
            Visualización de conexiones entre ciudades usando <span className="text-orange-400">Deck.gl</span> y <span className="text-blue-400">React Map GL</span>.
          </p>
        </div>

        <div className="hidden lg:block text-right text-xs text-gray-500">
          <p>Ejemplo de implementación</p>
          <p className="font-bold">Next.js 14+</p>
        </div>
      </div> */}

      <div className="w-full h-[600px] relative">
        <Map />
      </div>

      {/* <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-5xl text-gray-400 text-sm">
        <div className="p-4 border border-gray-800 rounded bg-gray-900/50">
          <h3 className="font-bold text-gray-200 mb-2">Paso 1: Origen</h3>
          <p>Haz clic en una ciudad (punto rojo). Se marcará en <span className="text-green-500 font-bold">verde</span> como origen.</p>
        </div>
        <div className="p-4 border border-gray-800 rounded bg-gray-900/50">
          <h3 className="font-bold text-gray-200 mb-2">Paso 2: Destino</h3>
          <p>Haz clic en otra ciudad para crear una línea permanente entre ellas.</p>
        </div>
        <div className="p-4 border border-gray-800 rounded bg-gray-900/50">
          <h3 className="font-bold text-gray-200 mb-2">Tecnología</h3>
          <p>Usa WebGL para renderizado de alto rendimiento. Datos locales, sin API Keys. Mapa base Open Source.</p>
        </div>
      </div> */}
    </main>
  );
}
