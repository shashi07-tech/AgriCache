
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  Cpu, 
  BarChart3, 
  Network,
  Activity,
  Zap,
  Clock,
  Droplets,
  Thermometer,
  Wind,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Maximize2
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';
import { 
  MappingType, ReplacementPolicy, SensorData, CacheBlock, MetricPoint 
} from './types';
import { CacheSimulationEngine } from './services/simulationEngine';
import { COLORS, CACHE_SIZES, HIT_TIME, MISS_PENALTY } from './constants';

// --- Sub-Components ---

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`bg-white rounded-[20px] shadow-sm p-5 border border-gray-100 ${className}`}>
    {children}
  </div>
);

const MetricStat: React.FC<{ label: string; value: string | number; subValue?: string; icon: React.ReactNode; color: string }> = ({ label, value, subValue, icon, color }) => (
  <Card>
    <div className="flex justify-between items-start mb-2">
      <div className={`p-2 rounded-xl bg-opacity-10`} style={{ backgroundColor: `${color}1A`, color }}>
        {icon}
      </div>
      {subValue && <span className="text-xs font-medium text-gray-400">{subValue}</span>}
    </div>
    <div className="flex flex-col">
      <span className="text-sm font-medium text-gray-500">{label}</span>
      <span className="text-2xl font-bold text-gray-900">{value}</span>
    </div>
  </Card>
);

// --- Demo Data Generator ---
const generateMockSensor = (index: number): SensorData => {
  const types = ['Moisture', 'Temperature', 'Humidity'];
  const type = types[index % types.length];
  const address = (index * 13) % 256;
  const now = new Date();
  now.setSeconds(now.getSeconds() - (100 - index) * 2);
  
  return {
    id: index + 100,
    type,
    value: type === 'Temperature' ? 22 + Math.random() * 5 : 45 + Math.random() * 10,
    unit: type === 'Temperature' ? '°C' : '%',
    timestamp: now.toLocaleTimeString(),
    address
  };
};

// Generate a larger pool of demo data for better history visualization
const initialDemoData = Array.from({ length: 80 }, (_, i) => generateMockSensor(i));

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'readings' | 'storage' | 'efficiency'>('overview');
  
  // Storage Config
  const [cacheSize, setCacheSize] = useState<number>(8);
  const [mappingType, setMappingType] = useState<MappingType>(MappingType.DIRECT);
  const [replacementPolicy, setReplacementPolicy] = useState<ReplacementPolicy>(ReplacementPolicy.LRU);
  
  // Graph Controls
  const [historyScale, setHistoryScale] = useState<number>(15);
  const historyOptions = [5, 10, 15, 25, 50, 75];

  // Simulation State with Demo Data
  const [cache, setCache] = useState<CacheBlock[]>(() => {
    const empty = CacheSimulationEngine.createEmptyCache(8);
    // Pre-fill some slots for demo
    initialDemoData.slice(-5).forEach((data, i) => {
      empty[i] = {
        id: i,
        tag: Math.floor(data.address / 8),
        data: data,
        lastUsed: i + 1,
        insertedAt: i + 1,
        isDirty: false
      };
    });
    return empty;
  });

  const [accessHistory, setAccessHistory] = useState<{address: number, hit: boolean}[]>(() => 
    initialDemoData.map((d, i) => ({ address: d.address, hit: i % 3 !== 0 }))
  );

  const [lastSensor, setLastSensor] = useState<SensorData | null>(initialDemoData[initialDemoData.length - 1]);
  
  const [metricsHistory, setMetricsHistory] = useState<MetricPoint[]>(() => {
    let hits = 0;
    return initialDemoData.map((d, i) => {
      if (i % 3 !== 0) hits++;
      const ratio = (hits / (i + 1)) * 100;
      return {
        time: d.timestamp,
        hitRatio: Number(ratio.toFixed(1)),
        amat: Number((HIT_TIME + ((1 - (ratio / 100)) * MISS_PENALTY)).toFixed(1))
      };
    });
  });

  const [autoSimulate, setAutoSimulate] = useState(false);
  const [highlightBlock, setHighlightBlock] = useState<number | null>(null);

  // Stats
  const hitCount = accessHistory.filter(a => a.hit).length;
  const hitRatio = accessHistory.length > 0 ? (hitCount / accessHistory.length) * 100 : 0;
  const amat = HIT_TIME + ((1 - (hitRatio / 100)) * MISS_PENALTY);

  // Generate Sensor Data
  const generateSensorData = useCallback((): SensorData => {
    const types = ['Moisture', 'Temperature', 'Humidity'];
    const type = types[Math.floor(Math.random() * types.length)];
    const id = Math.floor(Math.random() * 50);
    const address = Math.floor(Math.random() * 256); 

    let value = 0;
    let unit = '';
    if (type === 'Moisture') { value = 30 + Math.random() * 40; unit = '%'; }
    else if (type === 'Temperature') { value = 18 + Math.random() * 15; unit = '°C'; }
    else { value = 40 + Math.random() * 30; unit = '%'; }

    return {
      id,
      type,
      value: Number(value.toFixed(1)),
      unit,
      timestamp: new Date().toLocaleTimeString(),
      address
    };
  }, []);

  const handleAccess = useCallback(() => {
    const sensor = generateSensorData();
    const engine = new CacheSimulationEngine(cacheSize, mappingType, replacementPolicy);
    const result = engine.access(sensor.address, sensor, cache);
    
    setLastSensor(sensor);
    setCache(result.cache);
    setAccessHistory(prev => [{ address: sensor.address, hit: result.hit }, ...prev].slice(0, 100));
    setHighlightBlock(result.replacedId);
    
    setMetricsHistory(prev => {
      const newHistory = [...prev];
      const currentHits = accessHistory.filter(a => a.hit).length + (result.hit ? 1 : 0);
      const totalCount = accessHistory.length + 1;
      const newRatio = (currentHits / totalCount) * 100;
      
      newHistory.push({
        time: sensor.timestamp,
        hitRatio: Number(newRatio.toFixed(1)),
        amat: Number((HIT_TIME + ((1 - (newRatio / 100)) * MISS_PENALTY)).toFixed(1))
      });
      return newHistory.slice(-100);
    });

    setTimeout(() => setHighlightBlock(null), 800);
  }, [cache, cacheSize, mappingType, replacementPolicy, accessHistory, generateSensorData]);

  const resetSimulation = () => {
    setCache(CacheSimulationEngine.createEmptyCache(cacheSize));
    setAccessHistory([]);
    setLastSensor(null);
  };

  const renderTabContent = () => {
    switch(activeTab) {
      case 'overview':
        return (
          <div className="space-y-6 pb-24">
            <header className="px-1">
              <h1 className="text-3xl font-bold text-gray-900">AgriSmart Dashboard</h1>
              <p className="text-gray-500">Live monitoring for your farm</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricStat label="Data Speed" value={`${hitRatio.toFixed(1)}%`} subValue="Reliability" icon={<TrendingUp size={20} />} color={COLORS.success} />
              <MetricStat label="System Delay" value={`${amat.toFixed(1)}ms`} subValue="Avg. Lag" icon={<Clock size={20} />} color={COLORS.primary} />
              <MetricStat label="Power Saving" value="94.2%" subValue="Eco-Mode" icon={<Zap size={20} />} color={COLORS.warning} />
              <MetricStat label="Field Nodes" value="48" subValue="Active" icon={<Network size={20} />} color={COLORS.primary} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">Connection Stability</h3>
                    <p className="text-xs text-gray-400">Showing last {historyScale} readings</p>
                  </div>
                  <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                    {historyOptions.map(opt => (
                      <button 
                        key={opt}
                        onClick={() => setHistoryScale(opt)}
                        className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all ${historyScale === opt ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metricsHistory.slice(-historyScale)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="time" hide />
                      <YAxis domain={[0, 100]} stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="hitRatio" stroke={COLORS.primary} strokeWidth={3} dot={historyScale <= 15} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <h3 className="font-bold text-lg text-gray-800 mb-4">Smart Suggestions</h3>
                <div className="space-y-4">
                   <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <Droplets className="text-blue-500" size={24} />
                        <div>
                           <p className="text-xs font-semibold text-gray-400">WATERING</p>
                           <p className="text-sm font-bold">Auto-Irrigation</p>
                        </div>
                     </div>
                     <span className={`px-3 py-1 rounded-full text-xs font-bold ${hitRatio > 50 ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                        {hitRatio > 50 ? 'OPTIMIZED' : 'ADJUSTING'}
                     </span>
                   </div>
                   
                   <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <ShieldCheck className="text-green-500" size={24} />
                        <div>
                           <p className="text-xs font-semibold text-gray-400">CROP HEALTH</p>
                           <p className="text-sm font-bold">Plant Status</p>
                        </div>
                     </div>
                     <span className="px-3 py-1 rounded-full bg-green-100 text-green-600 text-xs font-bold">STABLE</span>
                   </div>

                   <button 
                    onClick={() => setAutoSimulate(!autoSimulate)}
                    className={`w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95 ${autoSimulate ? 'bg-red-500 shadow-red-200' : 'bg-blue-600 shadow-blue-200'}`}>
                    {autoSimulate ? 'Pause Monitoring' : 'Start Monitoring'}
                   </button>
                </div>
              </Card>
            </div>
          </div>
        );
      
      case 'readings':
        return (
          <div className="space-y-6 pb-24">
            <header className="px-1">
              <h1 className="text-3xl font-bold text-gray-900">Field Readings</h1>
              <p className="text-gray-500">Live data from your crops</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="md:col-span-1">
                <h3 className="font-bold text-lg mb-4">Check Sensor</h3>
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Input Queue</label>
                    <div className="h-24 bg-slate-50 rounded-xl border-dashed border-2 border-slate-200 flex items-center justify-center">
                      <p className="text-sm text-gray-400 text-center px-4">New readings appear here</p>
                    </div>
                  </div>
                  <button onClick={handleAccess} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-2">
                    <Zap size={18} /> Manual Refresh
                  </button>
                  <div className="p-3 bg-green-50 rounded-xl flex items-center gap-2 text-green-700 text-sm">
                    <Activity size={16} /> Data Cleaner: Active
                  </div>
                </div>
              </Card>

              <Card className="md:col-span-2">
                <h3 className="font-bold text-lg mb-4">Reading History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="py-3 text-xs font-bold text-gray-400 uppercase">Location ID</th>
                        <th className="py-3 text-xs font-bold text-gray-400 uppercase">Sensor</th>
                        <th className="py-3 text-xs font-bold text-gray-400 uppercase">Category</th>
                        <th className="py-3 text-xs font-bold text-gray-400 uppercase">Speed</th>
                        <th className="py-3 text-xs font-bold text-gray-400 uppercase">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {accessHistory.map((h, i) => (
                        <tr key={i} className="animate-in fade-in slide-in-from-top-1">
                          <td className="py-3 font-mono text-xs text-blue-600">Loc-0x{h.address.toString(16).toUpperCase()}</td>
                          <td className="py-3 text-sm font-medium">Node-{Math.floor(h.address / 4)}</td>
                          <td className="py-3 text-sm text-gray-500">Field Data</td>
                          <td className="py-3 text-sm">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${h.hit ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                              {h.hit ? 'INSTANT' : 'SLOW'}
                            </span>
                          </td>
                          <td className="py-3 text-xs text-gray-400">{(new Date()).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                      {accessHistory.length === 0 && (
                        <tr><td colSpan={5} className="py-10 text-center text-gray-400">No recent readings</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        );

      case 'storage':
        return (
          <div className="space-y-6 pb-24">
            <header className="px-1 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Quick Storage</h1>
                <p className="text-gray-500">Managing how data is saved</p>
              </div>
              <button 
                onClick={resetSimulation}
                className="px-4 py-2 bg-white rounded-full border border-gray-200 text-sm font-bold text-gray-600 shadow-sm">
                Clear Memory
              </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <Card className="lg:col-span-1 h-fit">
                <h3 className="font-bold text-lg mb-6">Storage Setup</h3>
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Memory Capacity</label>
                    <div className="flex gap-2">
                      {CACHE_SIZES.map(s => (
                        <button key={s} onClick={() => { setCacheSize(s); resetSimulation(); }} className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${cacheSize === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>{s} slots</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Sorting Style</label>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => { setMappingType(MappingType.DIRECT); resetSimulation(); }} className={`w-full py-2 px-3 text-left rounded-xl text-sm font-bold border transition-all ${mappingType === MappingType.DIRECT ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>Simple Sorting</button>
                      <button onClick={() => { setMappingType(MappingType.TWO_WAY); resetSimulation(); }} className={`w-full py-2 px-3 text-left rounded-xl text-sm font-bold border transition-all ${mappingType === MappingType.TWO_WAY ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>Smart Sorting</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Memory Cleaner</label>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => setReplacementPolicy(ReplacementPolicy.LRU)} className={`w-full py-2 px-3 text-left rounded-xl text-sm font-bold border transition-all ${replacementPolicy === ReplacementPolicy.LRU ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>Remove Oldest Used</button>
                      <button onClick={() => setReplacementPolicy(ReplacementPolicy.FIFO)} className={`w-full py-2 px-3 text-left rounded-xl text-sm font-bold border transition-all ${replacementPolicy === ReplacementPolicy.FIFO ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>Remove First Entered</button>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="lg:col-span-3 space-y-6">
                <Card>
                  <h3 className="font-bold text-lg mb-6">How data travels</h3>
                  <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8">
                     <div className="flex flex-col items-center">
                        <div className="w-20 h-28 bg-blue-50 border-2 border-blue-200 rounded-xl flex flex-col items-center justify-center font-bold text-blue-600 text-center px-2">
                          <Database size={24} className="mb-2" />
                          <span className="text-[10px]">Main Warehouse</span>
                        </div>
                        <span className="text-xs font-bold mt-2 text-gray-400">Slower Access</span>
                     </div>
                     <div className="flex-1 flex items-center gap-4 relative">
                        <div className="h-0.5 bg-gray-200 flex-1"></div>
                        <div className={`absolute left-1/2 -top-6 transform -translate-x-1/2 flex flex-col items-center gap-1 ${accessHistory[0]?.hit ? 'text-green-500' : accessHistory[0] ? 'text-red-500' : 'text-transparent'}`}>
                           <span className="text-[10px] font-black uppercase">{accessHistory[0]?.hit ? 'Instant' : 'Delayed'}</span>
                           {accessHistory[0]?.hit ? <Zap size={16} fill="currentColor" /> : <AlertCircle size={16} />}
                        </div>
                     </div>
                     <div className="flex flex-col items-center">
                        <div className="w-24 h-32 bg-orange-50 border-2 border-orange-200 rounded-2xl flex flex-col items-center justify-center font-bold text-orange-600">
                          <Cpu size={24} className="mb-2" />
                          <span className="text-[10px]">Handy Shelf</span>
                        </div>
                        <span className="text-xs font-bold mt-2 text-gray-400">Fast Access</span>
                     </div>
                     <div className="flex-1 flex items-center gap-4">
                        <div className="h-0.5 bg-gray-200 flex-1"></div>
                     </div>
                     <div className="flex flex-col items-center">
                        <div className="w-20 h-28 bg-indigo-50 border-2 border-indigo-200 rounded-xl flex flex-col items-center justify-center font-bold text-indigo-600">
                           <LayoutDashboard size={24} className="mb-2" />
                           <span className="text-[10px]">Field Screen</span>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {cache.map((block, idx) => (
                      <div 
                        key={idx} 
                        className={`p-4 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center text-center ${
                          highlightBlock === idx 
                          ? 'border-yellow-400 bg-yellow-50 scale-105 shadow-xl' 
                          : block.tag !== null 
                            ? 'border-blue-100 bg-white' 
                            : 'border-dashed border-gray-200 bg-gray-50'
                        }`}>
                        <span className="text-[10px] font-black text-gray-300 uppercase mb-1">Slot {idx}</span>
                        {block.tag !== null ? (
                          <>
                            <p className="text-xs font-bold text-blue-600 uppercase">Code: {block.tag}</p>
                            <p className="text-[10px] text-gray-400 mt-1 truncate w-full">{block.data?.type}</p>
                            <div className="w-full h-1 bg-blue-100 rounded-full mt-2 overflow-hidden">
                              <div className="h-full bg-blue-500" style={{ width: '100%' }}></div>
                            </div>
                          </>
                        ) : (
                          <span className="text-xs font-medium text-gray-300 py-4 italic">Available</span>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        );

      case 'efficiency':
        return (
          <div className="space-y-6 pb-24">
            <header className="px-1">
              <h1 className="text-3xl font-bold text-gray-900">Efficiency Report</h1>
              <p className="text-gray-500">Checking your farm system's health</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <h3 className="font-bold text-lg mb-6">Processing Speed</h3>
                <div className="space-y-6">
                  <div className="flex flex-col items-center py-8 bg-slate-50 rounded-3xl">
                    <span className="text-xs font-bold text-gray-400 mb-1">CURRENT RESPONSE SPEED</span>
                    <p className="text-3xl font-bold text-blue-600 mt-2">{amat.toFixed(2)} ms</p>
                    <p className="text-xs text-gray-400 mt-2 text-center px-6">Lower is better. This measures how fast information reaches your dashboard.</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Fast Shelf Search</span>
                      <span className="font-bold">{HIT_TIME} ms</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Search Success Rate</span>
                      <span className="font-bold text-green-500">{hitRatio.toFixed(1)} %</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Warehouse Wait Time</span>
                      <span className="font-bold">{MISS_PENALTY} ms</span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="font-bold text-lg mb-6">Storage Performance</h3>
                <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Basic', speed: 45 },
                        { name: 'Smart', speed: hitRatio || 50 },
                        { name: 'Average', speed: 62 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                        <YAxis hide />
                        <Tooltip cursor={{fill: '#f8fafc'}} />
                        <Bar dataKey="speed" fill={COLORS.primary} radius={[10, 10, 0, 0]} barSize={40} />
                      </BarChart>
                   </ResponsiveContainer>
                </div>
                <div className="mt-4 flex justify-center gap-6">
                   <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                     <div className="w-3 h-3 rounded bg-blue-500"></div> System Speed Score
                   </div>
                </div>
              </Card>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  useEffect(() => {
    let interval: any;
    if (autoSimulate) {
      interval = setInterval(handleAccess, 1500);
    }
    return () => clearInterval(interval);
  }, [autoSimulate, handleAccess]);

  return (
    <div className="min-h-screen bg-[#F2F2F7] selection:bg-blue-100 flex flex-col items-center">
      <main className="w-full max-w-5xl px-4 py-8 md:px-6 md:py-12">
        {renderTabContent()}
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-xl border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] px-6 py-3 rounded-[32px] flex items-center gap-2 z-50">
        <button 
          onClick={() => setActiveTab('overview')} 
          className={`flex flex-col items-center p-2 rounded-2xl transition-all ${activeTab === 'overview' ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}>
          <LayoutDashboard size={20} />
          <span className="text-[10px] font-bold mt-1">Overview</span>
        </button>
        <button 
          onClick={() => setActiveTab('readings')} 
          className={`flex flex-col items-center p-2 rounded-2xl transition-all ${activeTab === 'readings' ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}>
          <Database size={20} />
          <span className="text-[10px] font-bold mt-1">Readings</span>
        </button>
        <button 
          onClick={() => setActiveTab('storage')} 
          className={`flex flex-col items-center p-2 rounded-2xl transition-all ${activeTab === 'storage' ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}>
          <Cpu size={20} />
          <span className="text-[10px] font-bold mt-1">Memory</span>
        </button>
        <button 
          onClick={() => setActiveTab('efficiency')} 
          className={`flex flex-col items-center p-2 rounded-2xl transition-all ${activeTab === 'efficiency' ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}>
          <BarChart3 size={20} />
          <span className="text-[10px] font-bold mt-1">Health</span>
        </button>
      </nav>
    </div>
  );
}
