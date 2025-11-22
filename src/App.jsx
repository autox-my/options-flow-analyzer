import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  ReferenceLine
} from 'recharts';
import { Upload, FileText, Filter, TrendingUp, TrendingDown, Activity, Info, Sparkles, MessageSquare, Send, Loader2, ArrowRightLeft, Plus, Database, Layers, DollarSign, HelpCircle, Trash2, X, MoveDiagonal, Settings, Save, FolderOpen, Download, Cpu, ShieldAlert, Lightbulb } from 'lucide-react';

// --- Helper Functions ---

// Gemini API Helper
const callGemini = async (prompt) => {
  // ---------------------------------------------------------
  // 🔑 API KEY CONFIGURATION
  // For LOCAL use: Paste your key inside the quotes below.
  // ---------------------------------------------------------
  const apiKey = ""; 
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  
  const payload = { 
    contents: [{ parts: [{ text: prompt }] }] 
  };

  let delay = 1000;
  for (let i = 0; i <= 5; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`API Error: ${response.status} ${errData.error?.message || ''}`);
      }
      
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "No insights generated.";
    } catch (error) {
      if (i === 5) return `Error: ${error.message}. Please check your API Key.`;
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
};

const parsePremium = (str) => {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  let clean = str.toString().replace('$', '').replace(',', '');
  let multiplier = 1;
  
  if (clean.includes('K')) multiplier = 1000;
  else if (clean.includes('M')) multiplier = 1000000;
  
  clean = clean.replace(/[KM]/g, '');
  const result = parseFloat(clean) * multiplier;
  return isNaN(result) ? 0 : result;
};

const roundToNiceNumber = (num) => {
  if (num === 0) return 10000;
  const magnitude = Math.pow(10, Math.floor(Math.log10(num)));
  const normalized = num / magnitude;
  let scalar;
  if (normalized < 1.5) scalar = 2; 
  else if (normalized < 2.5) scalar = 3;
  else if (normalized < 5) scalar = 5;
  else scalar = 10;
  return scalar * magnitude;
};

const parseDateTime = (dateStr, timeStr) => {
  try {
    if (!dateStr || !timeStr) return 0;
    const [month, day, year] = dateStr.split('/').map(Number);
    const parts = timeStr.split(' ');
    const timeParts = parts[0].split(':').map(Number);
    let hours = timeParts[0];
    const minutes = timeParts[1];
    const seconds = timeParts[2] || 0;
    const modifier = parts[1]; 

    if (hours === 12) hours = 0;
    if (modifier === 'PM') hours += 12;

    return new Date(year, month - 1, day, hours, minutes, seconds).getTime();
  } catch (e) {
    return 0;
  }
};

const parseCSV = (text) => {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = [];
    let currentVal = '';
    let inQuotes = false;
    for(let char of line) {
        if (char === '"') { inQuotes = !inQuotes; continue; }
        if (char === ',' && !inQuotes) { values.push(currentVal); currentVal = ''; }
        else { currentVal += char; }
    }
    values.push(currentVal);

    const entry = {};
    headers.forEach((header, i) => {
      entry[header] = values[i]?.trim();
    });
    
    // Add explicit timestamp for sorting
    entry.timestamp = parseDateTime(entry.date, entry.time);
    return entry;
  });
};

const SAMPLE_DATA = `date,time,symbol,expiry,strike,put_call,side,spot,size,price,premium,sweep_block_split,volume,open_int,conds
11/18/2025,04:14:57 PM,SPY,12/05/2025,640,put,ask,659.74,150,$5.71,$85.7K,sweep,1646,4733,
11/18/2025,04:14:50 PM,SPY,11/19/2025,659,call,ask,659.83,201,$4.13,$83K,sweep,22249,360,unusual
11/18/2025,04:14:43 PM,SPY,12/19/2025,700,call,mid,659.80,225,$1.41,$31.8K,sweep,23540,97248,
11/18/2025,04:14:43 PM,SPY,11/19/2025,662,call,bid,659.78,150,$2.56,$38.4K,sweep,54933,583,unusual
11/18/2025,04:14:21 PM,SPY,11/20/2025,645,put,ask,659.68,250,$1.54,$38.5K,sweep,3452,1226,
11/18/2025,04:13:12 PM,SPY,11/18/2025,665,put,bid,659.65,1000,$5.30,$3M,block,54201,9214,
11/18/2025,04:11:22 PM,SPY,11/19/2025,655,put,ask,659.89,569,$1.57,$89.3K,sweep,15203,2145,
11/18/2025,04:11:22 PM,SPY,11/19/2025,665,put,bid,659.89,501,$5.29,$146.3K,sweep,1240,560,unusual`;

// --- Performance Monitor Component ---
const PerfMonitor = ({ isVisible }) => {
  const [metrics, setMetrics] = useState({ fps: 0, memory: 0, renderCount: 0, lastRenderTime: 0 });
  const renderCountRef = useRef(0);
  const lastRenderRef = useRef(performance.now());
  const lastRenderDurationRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());

  useEffect(() => {
    renderCountRef.current += 1;
    const now = performance.now();
    lastRenderDurationRef.current = now - lastRenderRef.current;
    lastRenderRef.current = now;
  });

  useEffect(() => {
    if (!isVisible) return;
    let animationFrameId;
    const loop = () => {
      const now = performance.now();
      frameCountRef.current++;
      if (now - lastFrameTimeRef.current >= 1000) {
        const memory = (window.performance && window.performance.memory) 
           ? Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024) 
           : 0;
        setMetrics({
          fps: frameCountRef.current,
          memory: memory,
          renderCount: renderCountRef.current,
          lastRenderTime: lastRenderDurationRef.current
        });
        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-green-400 p-3 rounded-lg font-mono text-xs z-[9999] shadow-2xl border border-green-900 w-48 pointer-events-none">
      <div className="flex justify-between border-b border-green-900 pb-1 mb-1">
        <span className="font-bold text-white">PERF MONITOR</span>
        <Cpu className="w-3 h-3 text-green-500 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-y-1">
        <span>FPS:</span>
        <span className={metrics.fps < 30 ? "text-red-400 font-bold" : "text-right"}>{metrics.fps}</span>
        <span>Renders:</span>
        <span className="text-right text-blue-300">{metrics.renderCount}</span>
        <span>Last Frame:</span>
        <span className={`text-right ${metrics.lastRenderTime > 30 ? "text-yellow-400" : ""}`}>{metrics.lastRenderTime.toFixed(1)}ms</span>
        <span>RAM:</span>
        <span className="text-right text-purple-300">{metrics.memory ? `${metrics.memory} MB` : 'N/A'}</span>
      </div>
    </div>
  );
};

// --- Components ---

const PercentageRing = ({ percent, colorClass, trackColorClass = "text-gray-100" }) => {
  const radius = 22; 
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;
  const safePercent = isNaN(percent) ? 0 : Math.min(100, Math.max(0, percent));

  return (
    <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0 ml-2">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="32" cy="32" r={radius} stroke="currentColor" strokeWidth="5" fill="transparent" className={trackColorClass} />
        <circle cx="32" cy="32" r={radius} stroke="currentColor" strokeWidth="5" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className={colorClass} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[11px] font-bold text-gray-700">{Math.round(safePercent)}%</span>
    </div>
  );
};

const StatCard = ({ title, value, subtext, icon: Icon, colorClass, percentage, ringColor }) => (
  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between h-full min-w-0">
    <div className="flex items-start space-x-3 min-w-0 flex-1">
      <div className={`p-2.5 rounded-full ${colorClass} bg-opacity-10 flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide truncate">{title}</p>
        <h3 className="text-xl font-bold text-gray-800 truncate">{value}</h3>
        {subtext && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{subtext}</p>}
      </div>
    </div>
    {typeof percentage !== 'undefined' && (
        <PercentageRing percent={percentage} colorClass={ringColor} />
    )}
  </div>
);

const SignalDot = (props) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy || !payload) return null;
    if (payload.signal === 'bullish') return <circle cx={cx} cy={cy} r={3} fill="#22c55e" stroke="white" strokeWidth={1} />;
    if (payload.signal === 'bearish') return <circle cx={cx} cy={cy} r={3} fill="#ef4444" stroke="white" strokeWidth={1} />;
    return null;
};

const CustomTooltip = ({ active, payload, label, metric }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload; 
    
    // Handling different payload structures for different charts
    if (data.netCumulative !== undefined) {
        // MOMENTUM CHART TOOLTIP
        const maValue = data.ma;
        const isBullish = maValue !== null && data.netCumulative > maValue;
        const spotPrice = data.spot;
        
        return (
            <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-md z-50 text-sm min-w-[160px]">
              <p className="font-bold text-gray-800 mb-1 border-b pb-1 text-xs">{data.fullDate}</p>
              <div className="space-y-1">
                 <div className="flex justify-between">
                    <span className="text-xs text-gray-500 font-medium">Asset Price:</span>
                    <span className="text-xs font-mono font-bold text-purple-600">
                        ${spotPrice ? spotPrice.toFixed(2) : 'N/A'}
                    </span>
                 </div>

                 <div className="flex justify-between">
                    <span className="text-xs text-gray-500">Net Flow ({data.bucketSizeLabel}):</span>
                    <span className={`text-xs font-mono font-bold ${data.netCumulative >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {metric === 'premium' ? `$${(data.netCumulative/1000).toFixed(1)}k` : `${data.netCumulative.toLocaleString()} vol`}
                    </span>
                 </div>
                 
                 {maValue !== null && (
                    <div className="flex justify-between">
                         <span className="text-xs text-gray-500">MA:</span>
                         <span className="text-xs font-mono text-orange-500 font-bold">
                            {metric === 'premium' ? `$${(maValue/1000).toFixed(1)}k` : `${Math.round(maValue).toLocaleString()}`}
                         </span>
                    </div>
                 )}

                 <div className="flex justify-between mt-1 pt-1 border-t border-gray-100">
                    <span className="text-xs text-gray-500">Trend:</span>
                    {maValue !== null ? (
                        <span className={`text-xs font-bold ${isBullish ? 'text-green-500' : 'text-red-500'}`}>
                            {isBullish ? 'ABOVE MA ▲' : 'BELOW MA ▼'}
                        </span>
                    ) : <span className="text-xs text-gray-400">Calibrating...</span>}
                 </div>
              </div>
            </div>
        );
    }

    // BAR CHART TOOLTIP
    const totalCallPrem = data.callPremiumNormal + data.callPremiumWhale;
    const totalPutPrem = Math.abs(data.putPremiumNormal + data.putPremiumWhale);
    const totalCallSize = data.callSizeNormal + data.callSizeWhale;
    const totalPutSize = Math.abs(data.putSizeNormal + data.putSizeWhale);
    
    const whaleCallPrem = data.callPremiumWhale;
    const whalePutPrem = Math.abs(data.putPremiumWhale);

    return (
      <div className="bg-white p-4 border border-gray-200 shadow-lg rounded-md z-50 text-sm min-w-[220px]">
        <p className="font-bold text-gray-800 mb-2 border-b pb-1">Strike: ${label}</p>
        <div className="flex flex-col space-y-3">
          <div className="flex flex-col space-y-1">
            <div className="flex justify-between items-center"><span className="text-green-600 font-semibold">Calls:</span><span className="font-mono text-gray-700 text-xs">{totalCallSize.toLocaleString()} vol / ${ (totalCallPrem/1000).toFixed(1) }k</span></div>
            {(metric === 'premium' ? whaleCallPrem > 0 : data.callSizeWhale > 0) && (<div className="flex justify-between items-center text-xs text-green-800 bg-green-50 px-1.5 py-1 rounded"><span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Whales:</span><span className="font-mono font-bold">{metric === 'premium' ? `$${(whaleCallPrem/1000).toFixed(1)}k` : `${data.callSizeWhale.toLocaleString()} vol`}</span></div>)}
          </div>
          <div className="flex flex-col space-y-1">
            <div className="flex justify-between items-center"><span className="text-red-500 font-semibold">Puts:</span><span className="font-mono text-gray-700 text-xs">{totalPutSize.toLocaleString()} vol / ${ (totalPutPrem/1000).toFixed(1) }k</span></div>
            {(metric === 'premium' ? Math.abs(whalePutPrem) > 0 : Math.abs(data.putSizeWhale) > 0) && (<div className="flex justify-between items-center text-xs text-red-800 bg-red-50 px-1.5 py-1 rounded"><span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Whales:</span><span className="font-mono font-bold">{metric === 'premium' ? `$${(Math.abs(whalePutPrem)/1000).toFixed(1)}k` : `${Math.abs(data.putSizeWhale).toLocaleString()} vol`}</span></div>)}
          </div>
          <div className="pt-2 border-t border-gray-100 text-xs text-gray-400 flex justify-between"><span>Net Sentiment:</span><span className={`font-bold ${totalCallPrem > totalPutPrem ? 'text-green-600' : 'text-red-500'}`}>{totalCallPrem > totalPutPrem ? 'BULLISH' : 'BEARISH'}</span></div>
        </div>
      </div>
    );
  }
  return null;
};

// --- Improved Markdown Formatter ---
const FormattedMarkdown = ({ text }) => {
  if (!text) return null;
  
  const renderInline = (content) => {
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
      return part;
    });
  };

  const lines = text.split('\n');
  const blocks = [];
  let currentTable = [];

  lines.forEach((line) => {
    // Fix for bullet + header (e.g. •### Title)
    // We check if line is a "fake header" and clean it up
    let cleanLine = line.trim();
    if (/^[\u2022\-\*]\s*#{2,}/.test(cleanLine)) {
        // Remove the bullet so it parses as a header below
        cleanLine = cleanLine.replace(/^[\u2022\-\*]\s*/, ''); 
    }

    if (cleanLine.startsWith('|') && cleanLine.endsWith('|')) { currentTable.push(cleanLine); } 
    else { 
        if (currentTable.length > 0) { blocks.push({ type: 'table', rows: currentTable }); currentTable = []; } 
        blocks.push({ type: 'text', content: cleanLine }); 
    }
  });
  if (currentTable.length > 0) blocks.push({ type: 'table', rows: currentTable });

  return (
    <div className="space-y-1.5 text-xs text-gray-700 leading-relaxed font-sans">
      {blocks.map((block, index) => {
        if (block.type === 'table') {
          const rows = block.rows;
          const headerRow = rows[0];
          const dataRows = rows.slice(2);
          const parseCells = (rowStr) => rowStr.split('|').filter(c => c.trim() !== '').map(c => c.trim());
          const headers = parseCells(headerRow);
          return (
            <div key={index} className="overflow-x-auto my-3 border rounded-md border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50"><tr>{headers.map((h, i) => <th key={i} className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">{renderInline(h)}</th>)}</tr></thead>
                <tbody className="bg-white divide-y divide-gray-100">{dataRows.map((r, rIndex) => { const cells = parseCells(r); return <tr key={rIndex} className={rIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>{cells.map((c, cIndex) => <td key={cIndex} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{renderInline(c)}</td>)}</tr>; })}</tbody>
              </table>
            </div>
          );
        } else {
          const trimmed = block.content;
          if (!trimmed) return <div key={index} className="h-2" />;
          
          // Header parsing
          if (trimmed.startsWith('###') || trimmed.startsWith('##')) {
             return <h4 key={index} className="font-bold text-indigo-900 mt-3 mb-1 text-sm">{renderInline(trimmed.replace(/^#+\s*/, ''))}</h4>;
          }
          
          // List Item parsing
          const isBullet = trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ');
          const isNumber = /^\d+\.\s/.test(trimmed);
          
          let content = trimmed;
          if (isBullet) content = trimmed.replace(/^[\*\-\u2022]\s*/, '');
          if (isNumber) content = trimmed.replace(/^\d+\.\s/, '');
          
          return (
            <div key={index} className={`flex ${isBullet || isNumber ? 'ml-2' : ''}`}>
              {isBullet && <span className="mr-1.5 text-indigo-400">•</span>}
              {isNumber && <span className="mr-1.5 font-semibold text-indigo-500">{trimmed.match(/^\d+\./)[0]}</span>}
              <span className="flex-1">{renderInline(content)}</span>
            </div>
          );
        }
      })}
    </div>
  );
};

const SAMPLE_DATA_OBJ = parseCSV(SAMPLE_DATA);

// --- ISOLATED CHAT INTERFACE (Fixes Typing Lag) ---
const ChatInterface = ({ suggestedQuestions, onSend, chatResponse, isChatLoading }) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onSend(inputValue);
    setInputValue(''); // Clear input after sending
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col h-[450px]">
      <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2 flex-shrink-0"><MessageSquare className="w-4 h-4" /> Ask the Data</h3>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 mb-3 flex flex-col">
          {chatResponse && (
              <div className="p-3 mb-4 bg-gray-50 rounded-md border-l-2 border-indigo-400 text-xs animate-in fade-in duration-300">
                  <FormattedMarkdown text={chatResponse} />
              </div>
          )}
          
           {isChatLoading && (
               <div className="p-3 mb-4 flex items-center gap-2 text-gray-400 text-xs">
                  <Loader2 className="w-3 h-3 animate-spin" /> Thinking...
               </div>
          )}

          <div className="mt-auto pt-2">
              <p className="text-[10px] text-gray-400 mb-2 uppercase font-bold tracking-wide">Suggested Queries:</p>
              <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q, i) => (
                  <button key={i} onClick={() => onSend(q)} className="text-[10px] px-2 py-1 bg-gray-50 border border-gray-200 rounded-full text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-left truncate max-w-full">
                      {q}
                  </button>
                  ))}
              </div>
          </div>
      </div>

      <form onSubmit={handleSubmit} className="relative flex-shrink-0 border-t border-gray-100 pt-3">
        <input 
          type="text" 
          value={inputValue} 
          onChange={(e) => setInputValue(e.target.value)} 
          placeholder="Type a question..." 
          className="w-full pl-3 pr-10 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
        />
        <button type="submit" disabled={isChatLoading || !inputValue} className="absolute right-1 top-4 p-1.5 text-gray-400 hover:text-indigo-600 disabled:opacity-50">
            {isChatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
};


const App = () => {
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('all');
  const [selectedExpiry, setSelectedExpiry] = useState('All');
  const chartLayout = 'vertical'; 
  const [metric, setMetric] = useState('premium'); 
  const [minValueFilter, setMinValueFilter] = useState(0); 
  const [showDatasetManager, setShowDatasetManager] = useState(false);
  const [showPerfMonitor, setShowPerfMonitor] = useState(false);
  const [maLength, setMaLength] = useState(30);
  const [showMA, setShowMA] = useState(false);
  const [isPulseLoading, setIsPulseLoading] = useState(false);
  const [isStrategyLoading, setIsStrategyLoading] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const [aiSummary, setAiSummary] = useState('');
  const [strategies, setStrategies] = useState('');
  const [chatResponse, setChatResponse] = useState(''); // Only response state needed in App
  const scrollContainerRef = useRef(null);

  // --- Constants ---
  const filterOptions = useMemo(() => {
      if (metric === 'premium') {
          return [
            { label: 'All Premium', value: 0 },
            { label: '> $10k', value: 10000 },
            { label: '> $100k', value: 100000 },
            { label: '> $500k', value: 500000 },
            { label: '> $1M', value: 1000000 },
          ];
      } else {
          return [
            { label: 'All Volume', value: 0 },
            { label: '> 100 Vol', value: 100 },
            { label: '> 500 Vol', value: 500 },
            { label: '> 1k Vol', value: 1000 },
            { label: '> 5k Vol', value: 5000 },
          ];
      }
  }, [metric]);

  const handleMetricChange = (newMetric) => { setMetric(newMetric); setMinValueFilter(0); };
  const handleRemoveDataset = (e, idToRemove) => { e.stopPropagation(); setDatasets(prev => { const updated = prev.filter(ds => ds.id !== idToRemove); if (selectedDatasetId === idToRemove) setSelectedDatasetId('all'); return updated; }); };

  const handleSaveProject = () => {
    if (datasets.length === 0) return;
    const optimizedDatasets = datasets.map(ds => {
        if (!ds.data || ds.data.length === 0) return ds;
        const headers = Object.keys(ds.data[0]);
        const rows = ds.data.map(row => headers.map(key => row[key]));
        return { ...ds, isCompact: true, headers: headers, rows: rows, data: null };
    });
    const dataStr = JSON.stringify(optimizedDatasets);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `options_project_${new Date().toISOString().slice(0,10)}.json`;
    link.href = url;
    link.click();
  };

  const handleLoadProject = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const loaded = JSON.parse(e.target.result);
        if (Array.isArray(loaded)) {
            const hydratedDatasets = loaded.map(ds => {
                 if (ds.isCompact && ds.headers && ds.rows) {
                     const reconstructedData = ds.rows.map(row => {
                         const obj = {};
                         ds.headers.forEach((key, index) => { obj[key] = row[index]; });
                         return obj;
                     });
                     return { ...ds, data: reconstructedData, isCompact: undefined, headers: undefined, rows: undefined };
                 }
                 return ds; 
             });
            setDatasets(hydratedDatasets);
            setSelectedDatasetId('all'); 
        } else { alert("Invalid project file format."); }
      } catch (err) { console.error("Failed to parse project file", err); }
    };
    reader.readAsText(file);
    event.target.value = ''; 
  };

  // Unified Smart Import
  const handleSmartImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      if (file.name.toLowerCase().endsWith('.json')) {
        try {
          const loaded = JSON.parse(content);
          if (Array.isArray(loaded)) {
             const hydratedDatasets = loaded.map(ds => {
                 if (ds.isCompact && ds.headers && ds.rows) {
                     const reconstructedData = ds.rows.map(row => {
                         const obj = {};
                         ds.headers.forEach((key, index) => { obj[key] = row[index]; });
                         return obj;
                     });
                     return { ...ds, data: reconstructedData, isCompact: undefined, headers: undefined, rows: undefined };
                 }
                 return ds; 
             });
            setDatasets(hydratedDatasets);
            setSelectedDatasetId('all');
          } else { alert("Invalid project file format. Expected an array."); }
        } catch (err) { console.error("Failed to parse JSON", err); alert("Error parsing project file."); }
      } else {
        try {
          const parsed = parseCSV(content);
          if (parsed.length === 0) { alert("No data found in CSV."); return; }
          let displayName = file.name;
          if (parsed.length > 0) {
              const firstRow = parsed[0];
              if (firstRow.date && firstRow.time && firstRow.symbol) { displayName = `${firstRow.symbol} - ${firstRow.date} ${firstRow.time}`; } 
              else if (firstRow.date) { displayName = `${firstRow.symbol || 'Data'} - ${firstRow.date}`; }
          }
          const newDataset = {
              id: Date.now().toString(),
              name: displayName,
              fileName: file.name,
              data: parsed,
              uploadTime: new Date().toLocaleTimeString()
          };
          setDatasets(prev => [...prev, newDataset]);
        } catch (err) { console.error("Failed to parse CSV", err); alert("Error parsing CSV file."); }
      }
    };
    reader.readAsText(file);
    event.target.value = ''; 
  };

  const loadSample = () => {
    const newDataset = { id: 'sample-1', name: 'Sample Data (SPY)', fileName: 'Sample_Data.csv', data: SAMPLE_DATA_OBJ, uploadTime: new Date().toLocaleTimeString() };
    setDatasets([newDataset]);
  };

  // --- Data Processing ---
  const activeData = useMemo(() => {
    if (selectedDatasetId === 'all') {
        const allRows = datasets.flatMap(ds => ds.data);
        const seen = new Set();
        const uniqueRows = [];
        allRows.forEach(row => {
            const ts = row.timestamp || '';
            const key = `${row.date}|${row.time}|${ts}|${row.symbol}|${row.expiry}|${row.strike}|${row.put_call}|${row.size}|${row.price}|${row.premium}`;
            if (!seen.has(key)) { seen.add(key); uniqueRows.push(row); }
        });
        return uniqueRows;
    }
    const ds = datasets.find(d => d.id === selectedDatasetId);
    return ds ? ds.data : [];
  }, [datasets, selectedDatasetId]);

  const expiries = useMemo(() => {
    if (!activeData.length) return [];
    const dates = new Set(activeData.map(d => d.expiry).filter(Boolean));
    return ['All', ...Array.from(dates).sort((a, b) => new Date(a) - new Date(b))];
  }, [activeData]);

  const processedData = useMemo(() => {
    const defaultStructure = { chartData: [], momentumData: [], totalCallPremium: 0, totalPutPremium: 0, totalCallSize: 0, totalPutSize: 0, avgSpot: 0, latestSpot: 0 };
    if (!activeData.length) return defaultStructure;

    const filtered = activeData.filter(row => {
      const matchesExpiry = selectedExpiry === 'All' || row.expiry === selectedExpiry;
      const valueToCheck = metric === 'premium' ? parsePremium(row.premium) : parseFloat(row.size || 0);
      const matchesFilter = valueToCheck >= minValueFilter;
      return matchesExpiry && matchesFilter;
    });

    const strikeMap = {};
    let totalCallPremium = 0, totalPutPremium = 0, totalCallSize = 0, totalPutSize = 0;
    let spotPrice = 0, spotCount = 0;
    const WHALE_PREMIUM_THRESHOLD = 1000000; 
    const WHALE_SIZE_THRESHOLD = 1000;
    const timeSeries = [];

    filtered.forEach(row => {
      const strike = parseFloat(row.strike);
      const premium = parsePremium(row.premium);
      const size = parseFloat(row.size || 0);
      const type = row.put_call?.toLowerCase();
      if (!strike || !type) return;
      if (row.spot) { spotPrice += parseFloat(row.spot); spotCount++; }
      if (!strikeMap[strike]) { strikeMap[strike] = { strike, callPremiumNormal: 0, callPremiumWhale: 0, putPremiumNormal: 0, putPremiumWhale: 0, callSizeNormal: 0, callSizeWhale: 0, putSizeNormal: 0, putSizeWhale: 0 }; }
      const isWhale = metric === 'premium' ? premium >= WHALE_PREMIUM_THRESHOLD : size >= WHALE_SIZE_THRESHOLD;
      if (type === 'call') {
        if (isWhale) { strikeMap[strike].callPremiumWhale += premium; strikeMap[strike].callSizeWhale += size; } 
        else { strikeMap[strike].callPremiumNormal += premium; strikeMap[strike].callSizeNormal += size; }
        totalCallPremium += premium; totalCallSize += size;
      } else if (type === 'put') {
        if (isWhale) { strikeMap[strike].putPremiumWhale -= premium; strikeMap[strike].putSizeWhale -= size; } 
        else { strikeMap[strike].putPremiumNormal -= premium; strikeMap[strike].putSizeNormal -= size; }
        totalPutPremium += premium; totalPutSize += size;
      }
      timeSeries.push({ timestamp: row.timestamp || 0, timeStr: row.time, fullDate: `${row.date} ${row.time}`, value: metric === 'premium' ? premium : size, type: type, spot: parseFloat(row.spot) || 0 });
    });

    let chartData = Object.values(strikeMap);
    chartData.sort((a, b) => b.strike - a.strike); 
    // DYNAMIC LOD BUCKETING (The Optimization)
    timeSeries.sort((a, b) => a.timestamp - b.timestamp);
    const latestSpot = timeSeries.length > 0 ? timeSeries[timeSeries.length - 1].spot : 0;
    
    // Determine Bucket Size based on total duration
    // < 1 day = 1 min, < 7 days = 15 mins, > 7 days = 1 hour
    let bucketDuration = 60000; // 1 minute default
    if (timeSeries.length > 0) {
        const duration = timeSeries[timeSeries.length-1].timestamp - timeSeries[0].timestamp;
        if (duration > 7 * 24 * 3600 * 1000) bucketDuration = 60 * 60000; // 1 hour
        else if (duration > 24 * 3600 * 1000) bucketDuration = 15 * 60000; // 15 min
    }
    const bucketedSeries = [];
    let currentBucket = null;
    timeSeries.forEach(item => {
        const bucketTime = Math.floor(item.timestamp / bucketDuration) * bucketDuration;
        if (!currentBucket || currentBucket.bucketTime !== bucketTime) {
            if (currentBucket) bucketedSeries.push(currentBucket);
            currentBucket = { bucketTime, timestamp: bucketTime, timeStr: item.timeStr, fullDate: item.fullDate, netValue: 0, spotSum: 0, count: 0, bucketSizeLabel: bucketDuration === 60000 ? '1m' : (bucketDuration === 900000 ? '15m' : '1h') };
        }
        const change = item.type === 'call' ? item.value : -item.value;
        currentBucket.netValue += change;
        currentBucket.spotSum += item.spot;
        currentBucket.count++;
    });
    if (currentBucket) bucketedSeries.push(currentBucket);

    let runningNet = 0;
    const momentumDataRaw = bucketedSeries.map(b => {
        runningNet += b.netValue;
        return { timeStr: b.timeStr, fullDate: b.fullDate, timestamp: b.timestamp, netCumulative: runningNet, spot: b.spotSum / b.count, bucketSizeLabel: b.bucketSizeLabel };
    });

    const momentumData = momentumDataRaw.map((item, index, arr) => {
        if (index < maLength - 1) { return { ...item, ma: null, signal: null }; }
        const slice = arr.slice(index - maLength + 1, index + 1);
        const sum = slice.reduce((acc, curr) => acc + curr.netCumulative, 0);
        const ma = sum / maLength;

        let signal = null;
        if (index > 0) {
             const prevSlice = arr.slice(index - maLength, index); 
             const prevSum = prevSlice.reduce((acc, curr) => acc + curr.netCumulative, 0);
             const prevMA = prevSum / maLength;
             const prevVal = arr[index - 1].netCumulative;
             const currVal = item.netCumulative;
             if (prevVal < prevMA && currVal > ma) signal = 'bullish';
             else if (prevVal > prevMA && currVal < ma) signal = 'bearish';
        }
        return { ...item, ma, signal };
    });

    return { chartData, momentumData, totalCallPremium, totalPutPremium, totalCallSize, totalPutSize, avgSpot: spotCount > 0 ? spotPrice / spotCount : 0, latestSpot };
  }, [activeData, selectedExpiry, minValueFilter, metric, maLength]);

  const { chartData, momentumData, totalCallPremium, totalPutPremium, totalCallSize, totalPutSize, avgSpot, latestSpot } = processedData;

  // Auto Scroll
  useEffect(() => {
    if (chartData.length > 0 && scrollContainerRef.current) {
      let maxVol = 0;
      let maxIndex = 0;
      chartData.forEach((d, i) => {
        let vol;
        if (metric === 'premium') vol = d.callPremiumNormal + d.callPremiumWhale + Math.abs(d.putPremiumNormal + d.putPremiumWhale);
        else vol = d.callSizeNormal + d.callSizeWhale + Math.abs(d.putSizeNormal + d.putSizeWhale);
        if (vol > maxVol) { maxVol = vol; maxIndex = i; }
      });
      const barSize = 25;
      const container = scrollContainerRef.current;
      const scrollTo = (maxIndex * barSize) - (container.clientHeight / 2) + (barSize / 2);
      container.scrollTo({ top: scrollTo, behavior: 'smooth' });
    }
  }, [processedData, metric]);

  const dataKeys = useMemo(() => {
    if (metric === 'premium') { return { callNormal: 'callPremiumNormal', callWhale: 'callPremiumWhale', putNormal: 'putPremiumNormal', putWhale: 'putPremiumWhale', formatter: (val) => `$${Math.abs(val / 1000).toFixed(0)}k` }; } 
    else { return { callNormal: 'callSizeNormal', callWhale: 'callSizeWhale', putNormal: 'putSizeNormal', putWhale: 'putSizeWhale', formatter: (val) => `${Math.abs(val).toLocaleString()}` }; }
  }, [metric]);

  const displayTotalCalls = metric === 'premium' ? totalCallPremium : totalCallSize;
  const displayTotalPuts = metric === 'premium' ? totalPutPremium : totalPutSize;
  const displayPCR = displayTotalCalls > 0 ? (displayTotalPuts / displayTotalCalls).toFixed(2) : "N/A";
  const totalVolume = displayTotalCalls + displayTotalPuts;
  const callPercentage = totalVolume > 0 ? (displayTotalCalls / totalVolume) * 100 : 0;
  const putPercentage = totalVolume > 0 ? (displayTotalPuts / totalVolume) * 100 : 0;
  const metricLabel = metric === 'premium' ? 'Premium' : 'Volume';
  const formatMetricValue = (val) => { if (metric === 'premium') return `$${(val / 1000000).toFixed(2)}M`; return val.toLocaleString(); };
  const sentiment = parseFloat(displayPCR) > 1 ? "Bearish" : "Bullish";
  const sentimentColor = sentiment === "Bearish" ? "text-red-500" : "text-green-600";
  
  const topStrike = chartData.length > 0 ? chartData.reduce((max, curr) => {
      const maxVol = metric === 'premium' 
        ? max.callPremiumNormal + max.callPremiumWhale + Math.abs(max.putPremiumNormal + max.putPremiumWhale)
        : max.callSizeNormal + max.callSizeWhale + Math.abs(max.putSizeNormal + max.putSizeWhale);
      const currVol = metric === 'premium' 
        ? curr.callPremiumNormal + curr.callPremiumWhale + Math.abs(curr.putPremiumNormal + curr.putPremiumWhale)
        : curr.callSizeNormal + curr.callSizeWhale + Math.abs(curr.putSizeNormal + curr.putSizeWhale);
      return currVol > maxVol ? curr : max;
  }, chartData[0]) : null;
  const topStrikeValue = topStrike ? (
      metric === 'premium' 
      ? (topStrike.callPremiumNormal + topStrike.callPremiumWhale + Math.abs(topStrike.putPremiumNormal + topStrike.putPremiumWhale)) 
      : (topStrike.callSizeNormal + topStrike.callSizeWhale + Math.abs(topStrike.putSizeNormal + topStrike.putSizeWhale))
  ) : 0;
  const topStrikeDisplay = metric === 'premium' ? `$${(topStrikeValue / 1000).toFixed(0)}K` : `${(topStrikeValue/1000).toFixed(1)}k`;

  const fixedBarSize = 10; 
  const gapFactor = 25; 
  const containerStyle = { height: Math.max(500, chartData.length * gapFactor), width: '100%' };
  const axisTickStyle = { fill: '#9ca3af', fontSize: 10 };
  const sharedMargin = { top: 0, right: 45, left: 45, bottom: 0 };
  const yAxisWidth = 90;
  // Nice Number Logic
  const maxAbsVal = chartData.length > 0 ? Math.max(
    ...chartData.map(d => Math.max(
       (metric === 'premium' ? d.callPremiumNormal + d.callPremiumWhale : d.callSizeNormal + d.callSizeWhale),
       Math.abs(metric === 'premium' ? d.putPremiumNormal + d.putPremiumWhale : d.putSizeNormal + d.putSizeWhale)
    )), metric === 'premium' ? 10000 : 100
  ) : 10000;
  const niceMax = roundToNiceNumber(maxAbsVal);
  const symmetricDomain = [-niceMax, niceMax];
  const symmetricTicks = [-niceMax, -niceMax/2, 0, niceMax/2, niceMax];

  const dateLabel = useMemo(() => {
    if (datasets.length === 0) return "0 Datasets Loaded";
    const uniqueDates = new Set();
    datasets.forEach(ds => { if (ds.data && ds.data.length > 0 && ds.data[0].date) { uniqueDates.add(ds.data[0].date); } });
    const countText = `${datasets.length} Dataset${datasets.length !== 1 ? 's' : ''} Loaded`;
    const dates = Array.from(uniqueDates);
    if (dates.length === 1) {
        try {
            const [month, day, year] = dates[0].split('/');
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            const formatted = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            return `${formatted} (${countText})`;
        } catch (e) { return `${dates[0]} (${countText})`; }
    }
    if (dates.length > 1) return `Multiple Dates (${countText})`;
    return countText;
  }, [datasets]);

  const generateContext = () => {
    if (!processedData || !activeData.length) return "";
    const contextPcr = metric === 'premium' ? (totalCallPremium > 0 ? (totalPutPremium / totalCallPremium).toFixed(2) : "N/A") : (totalCallSize > 0 ? (totalPutSize / totalCallSize).toFixed(2) : "N/A");
    const topStrikes = [...chartData].slice(0, 5).map(s => `Strike $${s.strike}`).join('; ');
    let netFlowTrend = "Flat", spotTrend = "Flat", divergence = "None";
    if (momentumData.length > 1) {
        const startFlow = momentumData[0].netCumulative;
        const endFlow = momentumData[momentumData.length - 1].netCumulative;
        const startSpot = momentumData[0].spot;
        const endSpot = momentumData[momentumData.length - 1].spot;
        if (endFlow > startFlow) netFlowTrend = "Accumulating (Bullish)"; else if (endFlow < startFlow) netFlowTrend = "Distributing (Bearish)";
        if (endSpot > startSpot) spotTrend = "Increasing"; else if (endSpot < startSpot) spotTrend = "Decreasing";
        if (spotTrend === "Decreasing" && netFlowTrend.includes("Bullish")) divergence = "Bullish Divergence (Price Down, Flow Up)";
        if (spotTrend === "Increasing" && netFlowTrend.includes("Bearish")) divergence = "Bearish Divergence (Price Up, Flow Down)";
    }
    return `Mode: ${metric.toUpperCase()} (Filter: ${minValueFilter}) Ticker: ${activeData[0]?.symbol} | Spot: $${latestSpot.toFixed(2)} Calls: ${metric==='premium' ? '$'+(totalCallPremium/1e6).toFixed(2)+'M' : totalCallSize} Puts: ${metric==='premium' ? '$'+(totalPutPremium/1e6).toFixed(2)+'M' : totalPutSize} PCR: ${contextPcr} Top Strikes: ${topStrikes} --- TREND ANALYSIS --- Net Flow Trend: ${netFlowTrend} Spot Price Trend: ${spotTrend} Divergence Detected: ${divergence}`;
  };

  const handleGenerateSummary = async () => {
      setIsPulseLoading(true); setAiSummary('');
      const context = generateContext();
      const prompt = `Expert summary for ${activeData[0]?.symbol} option flow. Mode: ${metric}. Filter: >${minValueFilter}. Context: ${context}. Provide 3 concise sentences on sentiment, levels, and whales. Use Markdown bold/lists/tables if needed.`;
      const res = await callGemini(prompt);
      setAiSummary(res); setIsPulseLoading(false);
  };

  const handleGenerateStrategies = async () => {
      setIsStrategyLoading(true); setStrategies('');
      const context = generateContext();
      const prompt = `Based on the following Options Flow analysis, suggest 2 specific option trading strategies (e.g., Bull Put Spread, Iron Condor) with entry/exit rationale. Context: ${context}. Format as Markdown list.`;
      const res = await callGemini(prompt);
      setStrategies(res); setIsStrategyLoading(false);
  };

  // This now only called when user submits, not on type
  const handleChatSubmit = async (query) => {
    setIsChatLoading(true);
    const context = generateContext();
    const prompt = `Context: ${context} User Question: "${query}" Answer strictly based on data. Format nicely with markdown tables/bolding if needed.`;
    const response = await callGemini(prompt);
    setChatResponse(response); 
    setIsChatLoading(false);
  };

  // Suggested Questions Logic
  const suggestedQuestions = useMemo(() => {
    if (!datasets.length) return [];
    return [
      `What is the sentiment for ${activeData[0]?.symbol || 'this ticker'}?`,
      "Are there any divergences?",
      "Show me the biggest whale trades",
      "What strike has the most volume?"
    ];
  }, [datasets, activeData]);

  if (datasets.length === 0) {
      return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><Upload className="text-blue-600 w-8 h-8" /></div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Options Flow Analyzer</h1>
          <p className="text-gray-500 mb-4 text-sm">Upload CSV or Load Project File</p>
          <div className="flex justify-center gap-3">
             <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"><Plus className="w-4 h-4" /> Import Data <input type="file" accept=".csv,.json" onChange={handleSmartImport} className="hidden" /></label>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-100"><button onClick={loadSample} className="text-sm text-gray-400 hover:text-blue-600 underline decoration-dotted">Or load sample data</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-800" onClick={() => setShowDatasetManager(false)}>
      <PerfMonitor isVisible={showPerfMonitor} />

      <div className="max-w-7xl mx-auto mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2"><Activity className="text-blue-600" /> Options Flow Analyzer</h1>
            <button onClick={(e) => { e.stopPropagation(); setShowDatasetManager(!showDatasetManager); }} className="text-gray-500 text-sm mt-1 flex items-center gap-2 hover:text-blue-600 transition-colors focus:outline-none"><Database className="w-4 h-4" /> <span className="underline decoration-dotted">{dateLabel}</span></button>
            {showDatasetManager && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-2 pb-2 border-b border-gray-100 mb-2"><span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Manage Datasets</span><button onClick={() => setShowDatasetManager(false)} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button></div>
                    <div className="max-h-60 overflow-y-auto">{datasets.map(ds => (
                            <div key={ds.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded group">
                                <div className="flex flex-col min-w-0"><span className="text-sm font-medium text-gray-700 truncate">{ds.name}</span><span className="text-[10px] text-gray-400">Imported: {ds.uploadTime}</span></div>
                                <button onClick={(e) => handleRemoveDataset(e, ds.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        ))}</div>
                </div>
            )}
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowPerfMonitor(!showPerfMonitor)} className={`p-2 rounded-lg transition-colors ${showPerfMonitor ? 'bg-green-100 text-green-600' : 'bg-white text-gray-400 border border-gray-200'}`} title="Toggle Performance Monitor"><Settings className="w-4 h-4" /></button>
            <button onClick={handleSaveProject} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors shadow-sm" title="Save Project"><Save className="w-4 h-4" /> Save</button>
             <label className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors shadow-sm"><Plus className="w-4 h-4" /> Import Data <input type="file" accept=".csv,.json" className="hidden" onChange={handleSmartImport} /></label>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title={`Total Call ${metricLabel}`} value={formatMetricValue(displayTotalCalls)} subtext="Bullish Flow" icon={TrendingUp} colorClass="text-green-600 bg-green-50" percentage={callPercentage} ringColor="text-green-500" />
          <StatCard title={`Total Put ${metricLabel}`} value={formatMetricValue(displayTotalPuts)} subtext="Bearish Flow" icon={TrendingDown} colorClass="text-red-500 bg-red-50" percentage={putPercentage} ringColor="text-red-500" />
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-center h-full">
            <div className="flex items-center justify-between mb-1"><h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Market Sentiment</h3><div className="relative group"><HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-blue-500" /><div className="absolute right-0 bottom-full mb-2 w-64 bg-gray-800 text-white text-xs p-3 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"><p className="mb-2"><strong>Put/Call Ratio (PCR):</strong></p><ul className="list-disc list-inside space-y-1"><li>{'>'} 1.0: Bearish (More Puts)</li><li>{'<'} 1.0: Bullish (More Calls)</li></ul></div></div></div>
            <div className="flex items-baseline space-x-2"><span className={`text-2xl font-bold ${sentimentColor}`}>{displayPCR}</span><span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 ${sentimentColor}`}>{sentiment}</span></div>
            <p className="text-[10px] text-gray-400 mt-1">PCR by <span className="font-semibold text-gray-600">{metricLabel}</span> ({metric === 'premium' ? '$' : 'Vol'})</p>
          </div>
           <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-center h-full">
             <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Most Active Strike</p>
             <div className="flex items-center gap-2 mt-1"><span className="text-2xl font-bold text-gray-800">${topStrike?.strike}</span></div>
             <p className="text-[10px] text-gray-400 mt-0.5">Activity: {topStrikeDisplay}</p>
          </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-[900px]">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 gap-4 flex-shrink-0">
            <div><h2 className="text-lg font-bold text-gray-800">Strike Price Analysis</h2><p className="text-xs text-gray-400">Y-Axis: Strike Price • X-Axis: {metric === 'premium' ? 'Premium ($)' : 'Volume (#)'}</p></div>
            <div className="flex flex-wrap items-center gap-2">
                {avgSpot > 0 && <span className="text-xs font-bold uppercase text-blue-500 bg-blue-50 px-2 py-1 rounded mr-2">Spot: ${latestSpot.toFixed(2)}</span>}
                <div className="flex items-center bg-gray-100 rounded-md px-2 py-1.5 border border-gray-200"><Database className="w-3 h-3 text-gray-400 mr-2" /><select value={selectedDatasetId} onChange={(e) => setSelectedDatasetId(e.target.value)} className="bg-transparent text-xs font-medium text-gray-700 focus:outline-none cursor-pointer min-w-[100px] max-w-[150px] truncate"><option value="all">All Datasets</option>{datasets.map(ds => (<option key={ds.id} value={ds.id}>{ds.name}</option>))}</select></div>
                <div className="flex items-center bg-gray-100 rounded-md px-2 py-1.5 border border-gray-200">{metric === 'premium' ? <DollarSign className="w-3 h-3 text-gray-400 mr-1" /> : <Layers className="w-3 h-3 text-gray-400 mr-1" />}<span className="text-[10px] text-gray-400 mr-1 uppercase font-bold">Min:</span><select value={minValueFilter} onChange={(e) => setMinValueFilter(Number(e.target.value))} className="bg-transparent text-xs font-medium text-gray-700 focus:outline-none cursor-pointer">{filterOptions.map(f => (<option key={f.value} value={f.value}>{f.label}</option>))}</select></div>
                <div className="flex bg-gray-100 rounded-md p-0.5 border border-gray-200 items-center">
                    <button onClick={() => handleMetricChange('premium')} className={`px-2 py-1 rounded text-xs font-medium transition-colors ${metric === 'premium' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} title="View by Premium ($)"><DollarSign className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleMetricChange('size')} className={`px-2 py-1 rounded text-xs font-medium transition-colors ${metric === 'size' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} title="View by Volume (Size)"><Layers className="w-3.5 h-3.5" /></button>
                    <div className="relative group ml-1 mr-1"><HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-blue-500" /><div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 text-white text-xs p-3 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"><p className="mb-2"><strong>Premium ($):</strong> Shows high-conviction bets.</p><p><strong>Volume (#):</strong> Shows activity & liquidity.</p></div></div>
                </div>
                <div className="flex items-center bg-gray-100 rounded-md px-2 py-1.5 border border-gray-200"><Filter className="w-3 h-3 text-gray-400 mr-2" /><select value={selectedExpiry} onChange={(e) => setSelectedExpiry(e.target.value)} className="bg-transparent text-xs font-medium text-gray-700 focus:outline-none cursor-pointer min-w-[80px]">{expiries.map(exp => (<option key={exp} value={exp}>{exp}</option>))}</select></div>
            </div>
          </div>

          {/* TORNADO CHART (FIXED VERTICAL) */}
          <div className="flex-1 flex flex-col min-h-0 border border-gray-100 rounded-lg overflow-hidden">
            <div className="h-[40px] w-full bg-gray-50/50 border-b border-gray-100 flex-shrink-0 flex">
                <div className="flex-1 pr-[14px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={chartData} margin={sharedMargin} stackOffset="sign">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                            <XAxis type="number" orientation="top" tickFormatter={dataKeys.formatter} stroke="#9ca3af" fontSize={10} tickLine={false} domain={symmetricDomain} allowDataOverflow={true} ticks={symmetricTicks} />
                            <YAxis type="category" dataKey="strike" width={yAxisWidth} tick={false} axisLine={false} /> 
                            <Bar dataKey={dataKeys.putNormal} fill="none" stroke="none" /> 
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div ref={scrollContainerRef} className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-50">
                <div style={containerStyle}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={chartData} margin={sharedMargin} stackOffset="sign" barSize={fixedBarSize}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                            <XAxis type="number" hide domain={symmetricDomain} allowDataOverflow={true} ticks={symmetricTicks} />
                            <YAxis dataKey="strike" type="category" width={yAxisWidth} tick={axisTickStyle} interval={0} />
                            <Tooltip content={<CustomTooltip metric={metric} />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                            <ReferenceLine x={0} stroke="#000" strokeOpacity={0.2} />
                            <Bar name="Puts (Normal)" dataKey={dataKeys.putNormal} stackId="a" fill="#f87171" radius={[0, 0, 0, 0]} stroke="none" />
                            <Bar name="Puts (Whale)" dataKey={dataKeys.putWhale} stackId="a" fill="#b91c1c" radius={[0, 0, 0, 0]} stroke="none" />
                            <Bar name="Calls (Normal)" dataKey={dataKeys.callNormal} stackId="a" fill="#4ade80" radius={[0, 0, 0, 0]} stroke="none" />
                            <Bar name="Calls (Whale)" dataKey={dataKeys.callWhale} stackId="a" fill="#15803d" radius={[0, 0, 0, 0]} stroke="none" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
          </div>

          {/* MOMENTUM CHART */}
          <div className="mt-6 pt-4 border-t border-gray-200 relative">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-bold text-gray-800">Momentum: Net Cumulative Flow ({metricLabel})</h2>
                <div className="flex items-center gap-2" title="Number of trades used for Moving Average calculation">
                    <span className="text-xs text-gray-500 font-medium">MA Length:</span>
                    <input 
                        type="number" 
                        min="2" 
                        max="2000" 
                        value={maLength} 
                        onChange={(e) => setMaLength(Number(e.target.value))} 
                        className="w-14 px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-center" 
                    />
                    <button 
                        onClick={() => setShowMA(!showMA)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${showMA ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                    >
                        {showMA ? 'MA On' : 'MA Off'}
                    </button>
                </div>
            </div>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={momentumData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                   <XAxis dataKey="timeStr" stroke="#9ca3af" fontSize={10} tickLine={false} minTickGap={30} />
                   {/* Left Axis: Net Flow */}
                   <YAxis yAxisId="left" stroke="#3b82f6" fontSize={10} tickLine={false} tickFormatter={(val) => metric==='premium' ? `$${(val/1000).toFixed(0)}k` : val} />
                   {/* Right Axis: Spot Price */}
                   <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} stroke="#f1c232" fontSize={10} tickLine={false} tickFormatter={(val) => `$${val.toFixed(2)}`} />
                   
                   <Tooltip content={<CustomTooltip metric={metric} />} />
                   <ReferenceLine y={0} yAxisId="left" stroke="#000" strokeOpacity={0.1} />
                   
                   {/* Net Flow Line */}
                   <Line 
                       yAxisId="left"
                       type="monotone" 
                       dataKey="netCumulative" 
                       stroke="#3b82f6" 
                       strokeWidth={2} 
                       // Updated to pass key explicitly if showMA is true, or render null to avoid object error
                       dot={({key, payload, cx, cy}) => showMA ? <SignalDot key={key} payload={payload} cx={cx} cy={cy} /> : null} 
                   />
                   {/* MA Line */}
                   {showMA && (
                       <Line yAxisId="left" type="monotone" dataKey="ma" stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} />
                   )}
                   {/* Spot Price Line */}
                   <Line yAxisId="right" type="monotone" dataKey="spot" stroke="#f1c232" strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. AI Insights (General) */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-lg shadow-sm border border-indigo-100 flex flex-col h-[450px]"> 
            <div className="flex items-center gap-2 mb-3 flex-shrink-0"><Sparkles className="w-5 h-5 text-indigo-600" /><h3 className="font-bold text-indigo-900">AI Market Pulse</h3></div>
            <div className="flex-1 overflow-y-auto min-h-0 pr-1">
                {!aiSummary && !isPulseLoading && (
                    <div className="h-full flex items-center justify-center">
                        <button onClick={handleGenerateSummary} className="px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-md text-sm font-semibold hover:bg-indigo-50 transition-colors shadow-sm flex items-center gap-2">✨ Analyze Sentiment</button>
                    </div>
                )}
                {isPulseLoading && (<div className="h-full flex items-center justify-center text-indigo-400 flex-col gap-2"><Loader2 className="w-6 h-6 animate-spin" /><span className="text-xs">Analyzing {metric} data...</span></div>)}
                {aiSummary && (<div className="text-xs text-indigo-800 leading-relaxed"><FormattedMarkdown text={aiSummary} /></div>)}
            </div>
            {aiSummary && (<div className="mt-3 pt-2 border-t border-indigo-100 flex-shrink-0"><button onClick={handleGenerateSummary} className="text-xs text-indigo-500 hover:underline font-medium w-full text-center">Refresh Analysis</button></div>)}
          </div>

          {/* 2. AI Strategy Lab */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-lg shadow-sm border border-emerald-100 flex flex-col h-[450px]"> 
            <div className="flex items-center gap-2 mb-3 flex-shrink-0"><Lightbulb className="w-5 h-5 text-emerald-600" /><h3 className="font-bold text-emerald-900">AI Strategy Lab</h3></div>
            <div className="flex-1 overflow-y-auto min-h-0 pr-1">
                {!strategies && !isStrategyLoading && (
                    <div className="h-full flex items-center justify-center">
                        <button onClick={handleGenerateStrategies} className="px-4 py-2 bg-white border border-emerald-200 text-emerald-600 rounded-md text-sm font-semibold hover:bg-emerald-50 transition-colors shadow-sm flex items-center gap-2">💡 Suggest Strategies</button>
                    </div>
                )}
                {isStrategyLoading && (<div className="h-full flex items-center justify-center text-emerald-400 flex-col gap-2"><Loader2 className="w-6 h-6 animate-spin" /><span className="text-xs">Generating alpha...</span></div>)}
                {strategies && (<div className="text-xs text-emerald-800 leading-relaxed"><FormattedMarkdown text={strategies} /></div>)}
            </div>
            {strategies && (<div className="mt-3 pt-2 border-t border-emerald-100 flex-shrink-0"><button onClick={handleGenerateStrategies} className="text-xs text-emerald-500 hover:underline font-medium w-full text-center">New Ideas</button></div>)}
          </div>

          {/* 3. Ask the Data (Chat) - ISOLATED */}
          <ChatInterface 
              suggestedQuestions={suggestedQuestions}
              onSend={handleChatSubmit}
              chatResponse={chatResponse}
              isChatLoading={isChatLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default App;