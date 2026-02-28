import { useEffect, useState } from 'react';
import { PlayCircle, ShieldCheck, FileCheck, CircleUser, ChevronDown, ChevronUp, Bot, ExternalLink, Activity } from 'lucide-react';
import { format } from 'date-fns';
import './index.css';

type Escrow = {
  id: number;
  seller_url: string;
  task: string;
  quality_criteria: string;
  amount: number;
  status: string;
  createdAt: number;
  result?: string;
  aiVerdict?: { score: number, verdict: string, reason: string };
  txHash?: string;
  resolvedAt?: number;
};

type Stats = {
  totalEscrows: number;
  totalVolume: number;
  successRate: number;
  avgScore: number;
  activePending: number;
};

export default function App() {
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [stats, setStats] = useState<Stats>({ totalEscrows: 0, totalVolume: 0, successRate: 0, avgScore: 0, activePending: 0 });
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<string>(import.meta.env.VITE_BUYER_PRIVATE_KEY || '');

  // Custom Form State
  const [customUrl, setCustomUrl] = useState('https://jsonplaceholder.typicode.com/posts/1');
  const [customTask, setCustomTask] = useState('Fetch post details');
  const [customCriteria, setCustomCriteria] = useState('Must return valid JSON with id 1');
  const [customAmount, setCustomAmount] = useState('1.50');
  const [customSeller, setCustomSeller] = useState('0x8888888888888888888888888888888888888888');
  const [loadingCustom, setLoadingCustom] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchEscrows();

    const wsUrl = window.location.protocol === 'https:' ? `wss://${window.location.host}/ws` : `ws://${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event.startsWith('escrow:')) {
        setEscrows((prev) => {
          const exists = prev.find(e => e.id === data.data.id);
          if (exists) {
            return prev.map(e => e.id === data.data.id ? data.data : e).sort((a, b) => b.createdAt - a.createdAt);
          }
          return [data.data, ...prev].sort((a, b) => b.createdAt - a.createdAt);
        });
        fetchStats();
      }
    };
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (e) { }
  };

  const fetchEscrows = async () => {
    try {
      const res = await fetch('/api/escrows');
      const data = await res.json();
      setEscrows(data.sort((a: any, b: any) => b.createdAt - a.createdAt));
    } catch (e) { }
  };

  const runDemo = async (quality: 'good' | 'bad') => {
    if (!privateKey) {
      alert("Please enter a Base Sepolia Private Key with USDC to run the real on-chain simulation.");
      return;
    }
    setLoadingDemo(quality);
    try {
      const { PinionClient, payX402Service } = await import('pinion-os');
      const pinion = new PinionClient({ privateKey });

      const targetUrl = quality === 'good' ? 'mock' : 'mock-bad';

      const proxyUrl = window.location.protocol + "//" + window.location.host + '/api/proxy';
      await payX402Service(pinion.signer, proxyUrl, {
        method: "POST",
        headers: {
          "x-target-url": targetUrl,
          "x-escrow-amount": "1000000",
          "x-quality-criteria": `Must be of ${quality} quality`,
          "Content-Type": "application/json"
        },
        body: { task: `Book flight with ${quality} quality` },
        maxAmount: "3000000" // Set slightly higher to bypass big int conversion bug
      });

    } catch (e: any) {
      console.error(e);
      alert("Simulation failed: " + e.message);
    }
    setLoadingDemo(null);
  };

  const runCustom = async () => {
    if (!privateKey) {
      alert("Please enter a Base Sepolia Private Key with USDC to run the real on-chain simulation.");
      return;
    }
    setLoadingCustom(true);
    try {
      const { PinionClient, payX402Service } = await import('pinion-os');
      const pinion = new PinionClient({ privateKey });

      const amountMicros = Math.floor(parseFloat(customAmount) * 1000000).toString();

      const proxyUrl = window.location.protocol + "//" + window.location.host + '/api/proxy';

      await payX402Service(pinion.signer, proxyUrl, {
        method: "POST",
        headers: {
          "x-target-url": customUrl,
          "x-escrow-amount": amountMicros,
          "x-quality-criteria": customCriteria,
          "x-seller-address": customSeller,
          "Content-Type": "application/json"
        },
        body: { task: customTask },
        maxAmount: (parseInt(amountMicros) + 2000000).toString()
      });

    } catch (e: any) {
      console.error(e);
      alert("Custom request failed: " + e.message);
    }
    setLoadingCustom(false);
  };

  return (
    <div className="container">
      <header className="header">
        <div className="header-left">
          <ShieldCheck size={40} className="text-emerald" />
          <div className="header-title">
            <h1>TrustGate</h1>
            <p>Escrow & AI Arbitration for x402</p>
          </div>
        </div>
        <div className="status-badge">
          <div className="pulse-dot"></div>
          <span>Base Sepolia Active</span>
        </div>
      </header>

      {/* Metrics Bar */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-title">Total Escrows</div>
          <div className="metric-value">{stats.totalEscrows}</div>
        </div>
        <div className="metric-card">
          <div className="metric-title">Total Volume</div>
          <div className="metric-value text-emerald">${(stats.totalVolume / 1000000).toFixed(2)} USDC</div>
        </div>
        <div className="metric-card">
          <div className="metric-title">Success Rate</div>
          <div className="metric-value">{stats.successRate.toFixed(1)}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-title">Average Score</div>
          <div className="metric-value">{stats.avgScore.toFixed(0)} / 100</div>
        </div>
        <div className="metric-card">
          <div className="metric-title">Active / Pending</div>
          <div className="metric-value text-amber">{stats.activePending}</div>
        </div>
      </div>

      <div className="main-grid">

        {/* Left Column: Flow & Demo Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          <div className="panel">
            <div className="panel-glow"></div>
            <h2 className="panel-title"><Activity className="text-emerald" size={20} /> Live Demo Panel</h2>
            <p className="panel-desc">Trigger a full x402 escrow cycle with a simulated autonomous seller agent.</p>
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="password"
                placeholder="0x... (Base Sepolia Private Key)"
                value={privateKey}
                onChange={e => setPrivateKey(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #333', background: '#111', color: '#fff' }}
              />
              <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>Needed for Pinion OS x402 payment simulation</p>
            </div>
            <div className="demo-btn-group">
              <button onClick={() => runDemo('good')} disabled={loadingDemo !== null} className="demo-btn btn-good">
                <div className="demo-btn-left">
                  <div className="icon-wrapper"><PlayCircle size={20} /></div>
                  <span>Good Quality Demo</span>
                </div>
                <span className="expected-tag">Expect Approve</span>
              </button>

              <button onClick={() => runDemo('bad')} disabled={loadingDemo !== null} className="demo-btn btn-bad">
                <div className="demo-btn-left">
                  <div className="icon-wrapper"><PlayCircle size={20} /></div>
                  <span>Bad Quality Demo</span>
                </div>
                <span className="expected-tag">Expect Refund</span>
              </button>
            </div>
          </div>

          <div className="panel">
            <h2 className="panel-title"><FileCheck className="text-purple" size={20} /> Custom Task Protocol</h2>
            <p className="panel-desc">Run a real autonomous transaction via x402 proxy.</p>

            <div className="custom-form">
              <div className="form-group">
                <label>Target API URL</label>
                <input type="text" value={customUrl} onChange={e => setCustomUrl(e.target.value)} placeholder="https://api.example.com/execute" className="custom-input" />
              </div>
              <div className="form-group">
                <label>Task Description (Payload)</label>
                <input type="text" value={customTask} onChange={e => setCustomTask(e.target.value)} placeholder="e.g. Find cheap flights" className="custom-input" />
              </div>
              <div className="form-group">
                <label>AI Quality Criteria</label>
                <textarea value={customCriteria} onChange={e => setCustomCriteria(e.target.value)} placeholder="How should the Arbiter evaluate this?" className="custom-input" rows={2} />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Escrow Amount (USDC)</label>
                  <input type="number" step="0.01" value={customAmount} onChange={e => setCustomAmount(e.target.value)} className="custom-input" />
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Seller Wallet Address</label>
                  <input type="text" value={customSeller} onChange={e => setCustomSeller(e.target.value)} className="custom-input" />
                </div>
              </div>
              <button
                onClick={runCustom}
                className="demo-btn"
                disabled={loadingCustom}
                style={{ width: '100%', marginTop: '1rem', background: '#1a1a2e', border: '1px solid #4a4a8a', justifyContent: 'center' }}
              >
                {loadingCustom ? 'Executing Custom Task...' : 'Execute Custom x402 Protocol'}
              </button>
            </div>
          </div>

          <div className="panel">
            <h2 className="panel-title"><Bot className="text-cyan" size={20} /> Protocol Flow</h2>
            <div className="flow-diagram">
              <div className="flow-line"></div>

              <div className="flow-node">
                <span className="flow-node-title text-emerald"><CircleUser size={16} /> Buyer Agent</span>
                <span className="flow-node-desc">Initiates x402 payment</span>
              </div>

              <div className="flow-pill-wrapper">
                <div className="flow-pill">Locks USDC in Contract</div>
              </div>

              <div className="flow-node">
                <span className="flow-node-desc">Executes task</span>
                <span className="flow-node-title text-purple">Seller Agent <Bot size={16} /></span>
              </div>

              <div className="flow-pill-wrapper">
                <div className="flow-pill">Submits Result to AI</div>
              </div>

              <div className="flow-node flow-node-ai">
                <span className="flow-node-title text-cyan"><FileCheck size={16} /> AI Arbiter</span>
                <span className="flow-node-desc">Evaluates against criteria</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Live Feed */}
        <div className="panel feed-panel">
          <h2 className="panel-title">Live Escrow Feed</h2>

          <div className="feed-list relative">
            {escrows.length === 0 && (
              <div className="feed-empty">
                <Activity size={48} />
                <p>No escrows yet. Run a demo to see activity.</p>
              </div>
            )}
            {escrows.map(e => (
              <EscrowCard key={e.id} escrow={e} />
            ))}
          </div>
        </div>

      </div >
    </div >
  );
}

function EscrowCard({ escrow }: { escrow: Escrow }) {
  const [expanded, setExpanded] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Created': return <span className="status-tag tag-blue">Created</span>;
      case 'ResultSubmitted': return <span className="status-tag tag-cyan">Result Submitted</span>;
      case 'Judging': return <span className="status-tag tag-purple"><div className="ping-dot"></div> Judging</span>;
      case 'Approved': return <span className="status-tag tag-emerald">Approved</span>;
      case 'Refunded': return <span className="status-tag tag-red">Refunded</span>;
      default: return null;
    }
  };

  return (
    <div className={`escrow-card ${escrow.status === 'Judging' ? 'highlight-judging' : ''}`}>
      <div className="escrow-header" onClick={() => setExpanded(!expanded)}>
        <div className="escrow-header-left">
          <div className="escrow-id">#{escrow.id}</div>
          <div className="escrow-info">
            <h3 className="escrow-title">{escrow.task}</h3>
            <p className="escrow-meta">
              <span>{(escrow.amount / 1000000).toFixed(2)} USDC</span> •
              <span>{format(escrow.createdAt, 'HH:mm:ss')}</span>
            </p>
          </div>
        </div>
        <div className="escrow-actions">
          {escrow.aiVerdict && (
            <div className="score-display">
              <span className={`score-value ${escrow.aiVerdict.score >= 70 ? 'text-emerald' : escrow.aiVerdict.score >= 40 ? 'text-amber' : 'text-red'}`}>
                {escrow.aiVerdict.score}
              </span>
              <span className="score-max">/ 100</span>
            </div>
          )}
          {getStatusBadge(escrow.status)}
          {expanded ? <ChevronUp size={20} className="text-secondary" /> : <ChevronDown size={20} className="text-secondary" />}
        </div>
      </div>

      {expanded && (
        <div className="escrow-details">
          <div className="detail-section">
            <div className="detail-block">
              <h4 className="detail-label">Quality Criteria</h4>
              <div className="detail-box">{escrow.quality_criteria}</div>
            </div>
            {escrow.result && (
              <div className="detail-block">
                <h4 className="detail-label">Seller Result</h4>
                <div className="detail-box">{escrow.result}</div>
              </div>
            )}
          </div>

          <div className="detail-section">
            <div className="detail-block">
              <h4 className="detail-label">AI Arbiter Reason</h4>
              {escrow.aiVerdict ? (
                <div className="detail-text">{escrow.aiVerdict.reason}</div>
              ) : (
                <div className="detail-text" style={{ fontStyle: 'italic', opacity: 0.7 }}>Waiting for judging...</div>
              )}
            </div>

            {escrow.txHash && (
              <div className="detail-block">
                <h4 className="detail-label">On-Chain Tx</h4>
                <a href={`https://sepolia.basescan.org/tx/${escrow.txHash}`} target="_blank" rel="noreferrer" className="tx-link">
                  {escrow.txHash.substring(0, 16)}... <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
