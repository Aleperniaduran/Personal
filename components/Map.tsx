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
    { name: 'Buenos Aires', coordinates: [-58.3816, -34.6037] },
    { name: 'Bogotá', coordinates: [-74.0721, 4.7110] },
    { name: 'Rio de Janeiro', coordinates: [-43.1729, -22.9068] }
];

// Connection interface
type Connection = {
    from: City;
    to: City;
    latency: number;
    type?: 'direct' | 'optimized';
};

// Graph definition for Dijkstra
const GRAPH: Record<string, Record<string, number>> = {
    'Ciudad de México': {
        'Lima': 136,
        'Santiago de Chile': 161,
        'Buenos Aires': 179,
        'Bogotá': 45,
        'Rio de Janeiro': 180
    },
    'Lima': {
        'Ciudad de México': 137, // Asymmetric (+1)
        'Santiago de Chile': 32,
        'Montevideo': 61,
        'Buenos Aires': 77,
        'Bogotá': 34, // Asymmetric (-1)
        'Rio de Janeiro': 89
    },
    'Santiago de Chile': {
        'Ciudad de México': 160, // Asymmetric (-1)
        'Lima': 31,
        'Buenos Aires': 22,
        'Montevideo': 30,
        'Bogotá': 88
    },
    'Buenos Aires': {
        'Ciudad de México': 180, // Asymmetric (+1)
        'Lima': 78,
        'Santiago de Chile': 31, // Asymmetric (+9 vs SCL->EZE 22)
        'Montevideo': 10,
        'Bogotá': 185,
        'Rio de Janeiro': 42
    },
    'Montevideo': {
        'Ciudad de México': 193,
        'Lima': 61,
        'Santiago de Chile': 30,
        'Buenos Aires': 10,
        'Rio de Janeiro': 33
    },
    'Bogotá': {
        'Ciudad de México': 48, // Asymmetric (+3)
        'Lima': 35,
        'Santiago de Chile': 85,
        'Buenos Aires': 190,
    },
    'Rio de Janeiro': {
        'Buenos Aires': 40,
        'Montevideo': 35,
        'Lima': 85,
        'Ciudad de México': 175
    }
};

// Helper to get city object by name
const getCityByName = (name: string) => CITIES.find(c => c.name === name)!;

// Dijkstra Algorithm
const findShortestPath = (startNode: string, endNode: string) => {
    const costs: Record<string, number> = {};
    const backtrace: Record<string, string | null> = {};
    const visited: string[] = [];

    // Init keys
    for (const city of CITIES) {
        costs[city.name] = Infinity;
    }
    costs[startNode] = 0;

    // Simple priority queue logic (array sort)
    while (true) {
        // Find lowest cost unvisited node
        let lowestCostNode: string | null = null;
        for (const city of CITIES) {
            if (!visited.includes(city.name)) {
                if (lowestCostNode === null || costs[city.name] < costs[lowestCostNode]) {
                    lowestCostNode = city.name;
                }
            }
        }

        if (lowestCostNode === null || costs[lowestCostNode] === Infinity) break;
        if (lowestCostNode === endNode) break; // Found destination

        visited.push(lowestCostNode);

        const neighbors = GRAPH[lowestCostNode] || {};
        for (const neighbor in neighbors) {
            const newCost = costs[lowestCostNode] + neighbors[neighbor];
            if (newCost < costs[neighbor]) {
                costs[neighbor] = newCost;
                backtrace[neighbor] = lowestCostNode;
            }
        }
    }

    // Reconstruct path
    const path: string[] = [];
    let current = endNode;
    while (current !== startNode) {
        if (!backtrace[current]) return null; // No path
        path.unshift(current);
        current = backtrace[current]!;
    }
    path.unshift(startNode);

    return { path, cost: costs[endNode] };
};

// Simulate latency based on the user's graph (Directional)
const getSimulatedLatency = (cityA: string, cityB: string): number => {
    // Check graph first
    if (GRAPH[cityA] && GRAPH[cityA][cityB]) return GRAPH[cityA][cityB];
    return Math.floor(Math.random() * 200) + 100;
};

const getLatencyColor = (latency: number): [number, number, number] => {
    if (latency < 50) return [74, 222, 128]; // Green
    if (latency <= 150) return [250, 204, 21]; // Yellow
    return [248, 113, 113]; // Red
};

export default function Map() {
    const [selectedCity, setSelectedCity] = useState<City | null>(null);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [optimizedRoute, setOptimizedRoute] = useState<{ path: string[], cost: number } | null>(null);

    // View state management
    const [viewState, setViewState] = useState<any>(INITIAL_VIEW_STATE);

    const handleOptimize = (conn: Connection) => {
        const result = findShortestPath(conn.from.name, conn.to.name);
        if (result) {
            setOptimizedRoute(result);
        }
    };

    const handleLayerClick = (info: any) => {
        const { object } = info;
        if (!object) return; // Clicked on empty space

        const city = object as City;

        if (!selectedCity) {
            // Step 1: Select Source
            setSelectedCity(city);
            setConnections([]); // Clear previous to focus on new analysis
            setOptimizedRoute(null);
        } else {
            // Step 2: Select Target
            if (city.name === selectedCity.name) {
                // Deselect if clicking the same one again
                setSelectedCity(null);
            } else {
                const latency = getSimulatedLatency(selectedCity.name, city.name);
                // Only allow one active analysis connection for clarity
                setConnections([{ from: selectedCity, to: city, latency, type: 'direct' }]);
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
        // Direct Connection Layer
        new ArcLayer({
            id: 'arcs-layer-direct',
            data: connections,
            pickable: true,
            getSourcePosition: (d: Connection) => d.from.coordinates,
            getTargetPosition: (d: Connection) => d.to.coordinates,
            getSourceColor: (d: Connection) => getLatencyColor(d.latency),
            getTargetColor: (d: Connection) => getLatencyColor(d.latency),
            getWidth: optimizedRoute ? 2 : 5, // Thinner if optimized is shown
            opacity: optimizedRoute ? 0.3 : 1, // Fade out if optimized is shown
        }),
        // Optimized Path Layer
        new ArcLayer({
            id: 'arcs-layer-optimized',
            data: optimizedRoute ? optimizedRoute.path.slice(0, -1).map((city, i) => ({
                from: getCityByName(city),
                to: getCityByName(optimizedRoute.path[i + 1])
            })) : [],
            getSourcePosition: (d: any) => d.from.coordinates,
            getTargetPosition: (d: any) => d.to.coordinates,
            getSourceColor: [0, 255, 255], // Cyan
            getTargetColor: [0, 255, 255], // Cyan
            getWidth: 6,
        }),
        new TextLayer({
            id: 'latency-labels',
            data: connections,
            pickable: false,
            getPosition: (d: Connection) => {
                const midLat = (d.from.coordinates[1] + d.to.coordinates[1]) / 2;
                const midLon = (d.from.coordinates[0] + d.to.coordinates[0]) / 2;
                return [midLon, midLat];
            },
            getText: (d: Connection) => `${d.latency}ms`,
            getSize: 15,
            getColor: [255, 255, 255],
            fontWeight: 'bold',
            backgroundColor: [0, 0, 0, 160],
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
                <p className="text-sm text-gray-300 mb-2">
                    {!selectedCity && connections.length === 0
                        ? ""
                        : selectedCity ? `Conectar ${selectedCity.name} con...` : "Análisis de ruta activo."}
                </p>

                {/* Analysis UI */}
                {connections.length > 0 && (
                    <div className="bg-gray-800/50 p-3 rounded pointer-events-auto">
                        {/* Direct Route Details */}
                        <div className="mb-3 border-b border-gray-700 pb-2">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-gray-400">Ruta Seleccionada:</span>
                                <span className={`font-bold ${connections[0].latency > 150 ? 'text-red-400' : 'text-green-400'}`}>
                                    {connections[0].latency}ms
                                </span>
                            </div>
                            <div className="text-xs text-gray-500 font-mono pl-2 border-l-2 border-gray-600">
                                <div>{connections[0].from.name}</div>
                                <div className="h-2 w-px bg-gray-700 ml-1 my-0.5"></div>
                                <div>{connections[0].to.name}</div>
                            </div>
                        </div>

                        {!optimizedRoute ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOptimize(connections[0]);
                                }}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2 px-2 rounded transition-colors flex items-center justify-center gap-2"
                            >
                                <span>⚡ Optimizar Ruta (Dijkstra)</span>
                            </button>
                        ) : (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                {/* Logic to determine which is better */}
                                {(() => {
                                    const isBetter = optimizedRoute.cost < connections[0].latency;
                                    const diff = Math.abs(connections[0].latency - optimizedRoute.cost);

                                    return isBetter ? (
                                        // Case A: Optimization Found (Dijkstra is faster)
                                        <>
                                            <div className="flex justify-between items-center bg-cyan-950/50 p-3 rounded border border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                                                <div>
                                                    <div className="text-xs text-cyan-400 font-bold uppercase tracking-wider mb-1">Nueva Ruta Óptima</div>
                                                    <span className="font-bold text-3xl text-cyan-300">
                                                        {optimizedRoute.cost}ms
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-green-400 font-bold bg-green-900/40 px-2 py-1 rounded inline-block mb-1">
                                                        -{diff}ms
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Path Visualization */}
                                            <div className="text-xs text-gray-400 font-mono border-l-2 border-cyan-500 pl-3 py-1 ml-1 space-y-1">
                                                {optimizedRoute.path.map((city, i) => (
                                                    <div key={city} className="flex items-center gap-2">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${city === connections[0].from.name || city === connections[0].to.name ? 'bg-white' : 'bg-cyan-600'}`}></div>
                                                        <span className={city === connections[0].from.name || city === connections[0].to.name ? 'text-white font-bold' : 'text-cyan-200'}>
                                                            {city}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        // Case B: Direct is Better (No optimization needed)
                                        <>
                                            <div className="bg-green-950/40 p-3 rounded border border-green-500/30">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-lg">✅</span>
                                                    <span className="text-sm font-bold text-green-200">La ruta seleccionada es la mas optima</span>
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    La red existente ({optimizedRoute.cost}ms) es más lenta que tu conexión seleccionada.
                                                </div>
                                            </div>

                                            {/* Alternative Path (Grayed out) */}
                                            <div className="mt-2 pt-2 border-t border-gray-700/50">
                                                <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Camino Alternativo por Red</div>
                                                <div className="text-xs text-gray-500 font-mono pl-2 border-l border-gray-700 space-y-1">
                                                    {optimizedRoute.path.map((city) => (
                                                        <div key={city} className="truncate">{city}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setConnections([]);
                                        setOptimizedRoute(null);
                                    }}
                                    className="w-full mt-2 bg-gray-700 hover:bg-gray-600 text-xs text-white py-2 rounded transition-colors font-medium"
                                >
                                    Limpiar Mapa
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
