'use client';

import React, { useState } from 'react';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, ArcLayer, TextLayer } from '@deck.gl/layers';
import { Map as ReactMap } from 'react-map-gl/maplibre'; // Use Maplibre instead of Mapbox
import 'maplibre-gl/dist/maplibre-gl.css'; // Use Maplibre CSS

// No token needed! Using free Carto basemaps via Maplibre.
// const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'; 
// Or use this alternative if the above fails:
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"; // Light style
// Let's use Dark Matter for the premium look:
const DARK_MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";


type City = {
    name: string;
    coordinates: [number, number];
};

const INITIAL_VIEW_STATE = {
    longitude: -65.0,
    latitude: -20.0,
    zoom: 2.5,
    pitch: 45,
    bearing: 0
};

const CITIES: City[] = [
    { name: 'Ciudad de México', coordinates: [-99.1332, 19.4326] },
    { name: 'Lima', coordinates: [-77.0428, -12.0464] },
    { name: 'Montevideo', coordinates: [-56.1645, -34.9011] },
    { name: 'Santiago de Chile', coordinates: [-70.6693, -33.4489] },
    { name: 'Buenos Aires', coordinates: [-58.3816, -34.6037] } // EZE
];

// Connection interface
type Connection = {
    from: City;
    to: City;
    latency: number;
};

// Simulate latency based on the user's graph (Directional)
const getSimulatedLatency = (cityA: string, cityB: string): number => {
    const key = `${cityA}-${cityB}`; // Directional key

    const latencies: Record<string, number> = {
        // Mexico connections
        'Ciudad de México-Lima': 136,
        'Lima-Ciudad de México': 137,

        'Ciudad de México-Santiago de Chile': 161,
        'Santiago de Chile-Ciudad de México': 160,

        'Ciudad de México-Buenos Aires': 179,
        'Buenos Aires-Ciudad de México': 194,

        // Lima connections
        'Lima-Montevideo': 61,
        'Montevideo-Lima': 61,

        'Lima-Buenos Aires': 77,
        'Buenos Aires-Lima': 78,

        // Santiago connections
        'Santiago de Chile-Montevideo': 30,
        'Montevideo-Santiago de Chile': 30,

        'Santiago de Chile-Buenos Aires': 22,
        'Buenos Aires-Santiago de Chile': 22,

        // Montevideo connections
        'Montevideo-Buenos Aires': 10,
        'Buenos Aires-Montevideo': 10,
    };
    return latencies[key] || Math.floor(Math.random() * 200) + 10;
};

const getLatencyColor = (latency: number): [number, number, number] => {
    if (latency < 50) return [74, 222, 128]; // Green
    if (latency <= 150) return [250, 204, 21]; // Yellow
    return [248, 113, 113]; // Red
};

export default function Map() {
    const [selectedCity, setSelectedCity] = useState<City | null>(null);
    const [connections, setConnections] = useState<Connection[]>([]);

    // View state management
    const [viewState, setViewState] = useState<any>(INITIAL_VIEW_STATE);

    const handleLayerClick = (info: any) => {
        const { object } = info;
        if (!object) return; // Clicked on empty space

        const city = object as City;

        if (!selectedCity) {
            // Step 1: Select Source
            setSelectedCity(city);
        } else {
            // Step 2: Select Target
            if (city.name === selectedCity.name) {
                // Deselect if clicking the same one again
                setSelectedCity(null);
            } else {
                // Create connection if it doesn't exist (Directional check)
                const exists = connections.some(
                    c => c.from.name === selectedCity.name && c.to.name === city.name
                );

                if (!exists) {
                    const latency = getSimulatedLatency(selectedCity.name, city.name);
                    setConnections(prev => [...prev, { from: selectedCity, to: city, latency }]);
                }
                // Reset selection to allow new chain
                setSelectedCity(null);
            }
        }
    };

    const layers = [
        new ScatterplotLayer({
            id: 'cities-layer',
            data: CITIES,
            pickable: true,
            opacity: 1,
            stroked: true,
            filled: true,
            radiusScale: 6,
            radiusMinPixels: 8,
            radiusMaxPixels: 30,
            lineWidthMinPixels: 2,
            getPosition: (d: City) => d.coordinates,
            getFillColor: (d: City) => {
                if (selectedCity && d.name === selectedCity.name) return [255, 255, 255]; // White for Source
                return [59, 130, 246]; // Blue for others (matches image style)
            },
            getLineColor: [0, 0, 0],
            getLineWidth: 2,
            updateTriggers: {
                getFillColor: [selectedCity]
            }
        }),
        new TextLayer({
            id: 'city-labels',
            data: CITIES,
            pickable: false,
            getPosition: (d: City) => d.coordinates,
            getText: (d: City) => d.name,
            getSize: 14,
            getTextAnchor: 'middle',
            getAlignmentBaseline: 'center',
            pixelOffset: [0, -25],
            getColor: [255, 255, 255],
            outlineWidth: 2,
            outlineColor: [0, 0, 0],
            fontWeight: 'bold',
            fontFamily: 'monospace'
        }),
        new ArcLayer({
            id: 'arcs-layer',
            data: connections,
            pickable: true,
            getSourcePosition: (d: Connection) => d.from.coordinates,
            getTargetPosition: (d: Connection) => d.to.coordinates,
            getSourceColor: (d: Connection) => getLatencyColor(d.latency),
            getTargetColor: (d: Connection) => getLatencyColor(d.latency),
            getWidth: 4,
        }),
        new TextLayer({
            id: 'latency-labels',
            data: connections,
            pickable: false,
            getPosition: (d: Connection) => {
                const midLat = (d.from.coordinates[1] + d.to.coordinates[1]) / 2;
                const midLon = (d.from.coordinates[0] + d.to.coordinates[0]) / 2;
                // Simple midpoint. For arcs height, we might want to lift it a bit, but simple 2D map check is okay for now.
                // Actually, arc is 3D. Let's lift it slightly? No, stick to ground for readability or just use midpoint.
                return [midLon, midLat];
            },
            getText: (d: Connection) => `${d.latency}ms`,
            getSize: 15, // 25% larger (12 * 1.25)
            getColor: [255, 255, 255],
            fontWeight: 'bold', // "More white" / bolder
            backgroundColor: [0, 0, 0, 160], // Slightly less opaque background for better contrast
            getAngle: 0,
            getTextAnchor: 'middle',
            getAlignmentBaseline: 'center',
        })
    ];

    return (
        <div className="relative w-full h-[600px] rounded-xl overflow-hidden shadow-2xl border border-gray-700 bg-black">
            <DeckGL
                viewState={viewState}
                onViewStateChange={({ viewState }) => setViewState(viewState)}
                controller={true}
                layers={layers}
                style={{ width: '100%', height: '100%' }}
                onClick={handleLayerClick}
                pickingRadius={20}
                getCursor={({ isHovering }) => isHovering ? 'pointer' : 'grab'}
                getTooltip={({ object }) => object && object.from ? `${object.from.name} -> ${object.to.name}: ${object.latency}ms` : (object && object.name)}
            >
                <ReactMap
                    mapStyle={DARK_MAP_STYLE}
                    reuseMaps
                />
            </DeckGL>

            {/* Helper overlay UI */}
            <div className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur text-white p-4 rounded-lg border border-gray-600 max-w-xs z-10 select-none pointer-events-none">
                <h3 className="font-bold text-lg mb-2">Monitor de Latencia</h3>

                {/* Legend */}
                <div className="flex gap-2 mb-4 text-xs font-mono bg-black/50 p-2 rounded">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-400"></div>&lt;50ms</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-400"></div>50-150</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-400"></div>&gt;150ms</div>
                </div>

                {/* <p className="text-sm text-gray-300 mb-2">
                    {!selectedCity
                        ? "Haz clic en dos ciudades para medir latencia."
                        : `Conectar ${selectedCity.name} con...`}
                </p> */}

                <div className="mt-2 pt-2 border-t border-gray-700 pointer-events-auto">
                    <div className="flex justify-between items-center text-gray-400 text-xs mb-2">
                        <span>Enlaces activos:</span>
                        <span className="font-bold text-white text-lg">{connections.length}</span>
                    </div>

                    {connections.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setConnections([]);
                            }}
                            className="w-full bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 px-2 rounded transition-colors"
                        >
                            Limpiar Mapa
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
