"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import API from "@/services/api"

export default function CompleteDelivery() {
  const router = useRouter()
  const [deliveries, setDeliveries] = useState(0)
  const [distance,   setDistance]   = useState(0)
  const [result,     setResult]     = useState<any>(null)
  const [loading,    setLoading]    = useState(false)

  // 🔹 SIMULATE — logic unchanged
  const simulateDelivery = () => {
    setDeliveries(Math.floor(Math.random() * 3) + 1)
    setDistance(Number((Math.random() * 5 + 1).toFixed(2)))
    setResult(null)
  }

  // 🔹 SUBMIT — logic unchanged
  const submitDelivery = () => {
    if (deliveries === 0 || distance === 0) { alert("Please simulate delivery first"); return }
    const token = localStorage.getItem("user_token")
    if (!token) { alert("Login first"); router.push("/user/login"); return }
    setLoading(true)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lon = position.coords.longitude
        const lateDelivery = Math.random() > 0.7
        try {
          const res = await API.post(
            "/earnings/complete-delivery",
            null,
            { params: { deliveries, distance_km: distance, lat, lon, late_delivery: lateDelivery } }
          )
          setResult(res.data)
          setTimeout(() => router.push("/earnings"), 3000)
        } catch (err) { console.error(err); alert("Delivery API failed") }
        finally { setLoading(false) }
      },
      (error) => { console.error(error); alert("Location permission denied"); setLoading(false) }
    )
  }

  const simulated = deliveries > 0 && distance > 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

        .cd-root {
          min-height: 100vh;
          background-color: #0a0c10;
          background-image:
            radial-gradient(ellipse 70% 45% at 50% -5%, rgba(34,197,94,.07) 0%, transparent 70%),
            linear-gradient(180deg,#0a0c10 0%,#0f1318 100%);
          color: #e8eaf0; font-family: 'DM Sans',sans-serif;
        }

        .cd-inner { max-width: 600px; margin: 0 auto; padding: 52px 24px 80px; }

        .cd-flow { display:flex;align-items:center;gap:0;margin-bottom:48px;overflow-x:auto; }
        .cd-flow-step { display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#334155;white-space:nowrap; }
        .cd-flow-step.done{color:#22c55e;} .cd-flow-step.active{color:#fb923c;}
        .cd-flow-num { width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700; }
        .cd-flow-step.done .cd-flow-num{background:#22c55e;border-color:#22c55e;color:#0a0c10;}
        .cd-flow-step.active .cd-flow-num{background:#f97316;border-color:#f97316;color:#fff;}
        .cd-flow-arrow { width:22px;height:1px;background:rgba(255,255,255,.1);margin:0 6px;flex-shrink:0; }

        .cd-eyebrow { font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#475569;margin-bottom:10px; }
        .cd-title { font-family:'Bebas Neue',sans-serif;font-size:clamp(48px,7vw,78px);letter-spacing:.04em;line-height:.92;margin-bottom:10px; }
        .cd-title span { background:linear-gradient(135deg,#4ade80,#22c55e);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .cd-sub { font-size:14px;color:#475569;margin-bottom:36px;font-weight:400; }

        /* SIMULATE CARD */
        .cd-card { background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:28px;margin-bottom:16px;animation:cdFadeUp .5s ease both; }
        .cd-card-label { font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#475569;margin-bottom:20px; }

        .cd-stats { display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px; }
        .cd-stat { background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:18px; }
        .cd-stat-key { font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#334155;margin-bottom:8px; }
        .cd-stat-val { font-family:'Bebas Neue',sans-serif;font-size:36px;letter-spacing:.03em;line-height:1;transition:color .3s; }
        .cd-stat-unit { font-size:14px;font-weight:400;color:#475569;margin-left:3px; }

        /* ML badge on stat */
        .cd-ml-badge { display:inline-flex;align-items:center;gap:5px;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.22);border-radius:100px;padding:3px 10px;font-size:10px;font-weight:600;color:#fb923c;letter-spacing:.08em;text-transform:uppercase;margin-top:8px; }

        .cd-actions { display:flex;gap:10px; }
        .cd-btn { flex:1;padding:14px 16px;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;border:none;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px; }
        .cd-btn-sim { background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)!important;color:#94a3b8; }
        .cd-btn-sim:hover { background:rgba(255,255,255,.09);color:#e8eaf0; }
        .cd-btn-submit { background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;box-shadow:0 4px 16px rgba(34,197,94,.28); }
        .cd-btn-submit:hover:not(:disabled) { transform:translateY(-2px);box-shadow:0 8px 24px rgba(34,197,94,.4); }
        .cd-btn-submit:disabled { opacity:.5;cursor:not-allowed; }
        .cd-spin { width:13px;height:13px;border:2px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:cdSpin .7s linear infinite; }
        @keyframes cdSpin { to{transform:rotate(360deg)} }

        /* ML info strip */
        .cd-ml-strip { display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px; }
        .cd-ml-pill { display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:100px;padding:5px 12px;font-size:12px;font-weight:500;color:#64748b; }

        /* RESULT */
        .cd-result { background:rgba(34,197,94,.04);border:1px solid rgba(34,197,94,.18);border-radius:18px;padding:28px;animation:cdFadeUp .4s ease both; }
        .cd-result-bar { height:2px;background:linear-gradient(90deg,transparent,#22c55e,transparent);border-radius:100px;margin-bottom:24px; }
        .cd-result-label { font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#475569;margin-bottom:18px; }

        .cd-breakdown { display:flex;flex-direction:column;gap:8px;margin-bottom:14px; }
        .cd-row { display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:9px;background:rgba(255,255,255,.025); }
        .cd-row-key { font-size:13px;color:#64748b; }
        .cd-row-val { font-size:13px;font-weight:500;color:#94a3b8; }
        .cd-row-val.pos { color:#4ade80; } .cd-row-val.neg { color:#f87171; }

        .cd-total { display:flex;justify-content:space-between;align-items:center;padding:16px;border-radius:12px;background:rgba(34,197,94,.07);border:1px solid rgba(34,197,94,.18);margin-top:12px; }
        .cd-total-key { font-size:13px;font-weight:600;color:#86efac; }
        .cd-total-val { font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:.04em;color:#4ade80; }

        /* AI risk badge */
        .cd-ai-box { background:rgba(249,115,22,.06);border:1px solid rgba(249,115,22,.18);border-radius:12px;padding:14px 16px;margin-top:12px; }
        .cd-ai-title { font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#475569;margin-bottom:8px; }
        .cd-ai-row { display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px; }
        .cd-ai-key { color:#475569; } .cd-ai-val { color:#fb923c;font-weight:500; }

        .cd-redirect { margin-top:14px;display:flex;align-items:center;gap:8px;font-size:12px;color:#334155; }
        .cd-dot { width:6px;height:6px;border-radius:50%;background:#22c55e;animation:cdPulse 1.2s ease-in-out infinite; }
        @keyframes cdPulse{0%,100%{opacity:1}50%{opacity:.3}}

        @keyframes cdFadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @media(max-width:480px){ .cd-actions{flex-direction:column;} }
      `}</style>

      <div className="cd-root">
        <Navbar />
        <div className="cd-inner">

          <div className="cd-flow">
            {[
              { n:"✓",l:"Login",   s:"done"  },{ n:"✓",l:"Enroll",  s:"done"  },
              { n:"✓",l:"Pay",     s:"done"  },{ n:"✓",l:"Policies",s:"done"  },
              { n:"✓",l:"Earnings",s:"done"  },{ n:"6",l:"Delivery", s:"active"},
              { n:"7",l:"Risk Map",s:""      },
            ].map((step, i, arr) => (
              <div key={step.l} style={{ display:"flex", alignItems:"center" }}>
                <div className={`cd-flow-step${step.s ? ` ${step.s}` : ""}`}>
                  <div className="cd-flow-num">{step.n}</div>{step.l}
                </div>
                {i < arr.length - 1 && <div className="cd-flow-arrow" />}
              </div>
            ))}
          </div>

          <p className="cd-eyebrow">Step 6 of 7 — Partner Portal</p>
          <h1 className="cd-title">Delivery<br /><span>Simulator</span></h1>
          <p className="cd-sub">Simulate a run. AI predicts delay risk. Payout calculated instantly.</p>

          {/* Simulate card */}
          <div className="cd-card">
            <p className="cd-card-label">Current Run</p>

            <div className="cd-stats">
              <div className="cd-stat">
                <div className="cd-stat-key">Deliveries</div>
                <div className="cd-stat-val" style={{ color: simulated ? "#e8eaf0" : "#1e293b" }}>
                  {simulated ? deliveries : "—"}
                </div>
                {simulated && <div className="cd-ml-badge">🤖 AI scored</div>}
              </div>
              <div className="cd-stat">
                <div className="cd-stat-key">Distance</div>
                <div className="cd-stat-val" style={{ color: simulated ? "#e8eaf0" : "#1e293b" }}>
                  {simulated ? <>{distance}<span className="cd-stat-unit">km</span></> : "—"}
                </div>
                {simulated && <div className="cd-ml-badge">📍 GPS tracked</div>}
              </div>
            </div>

            <div className="cd-actions">
              <button className="cd-btn cd-btn-sim" onClick={simulateDelivery}>🎲 Simulate Run</button>
              <button className="cd-btn cd-btn-submit" onClick={submitDelivery}
                disabled={loading || !simulated}>
                {loading ? <><span className="cd-spin" />Processing…</> : "Submit →"}
              </button>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className="cd-result">
              <div className="cd-result-bar" />
              <p className="cd-result-label">Earnings Breakdown</p>

              <div className="cd-ml-strip">
                <span className="cd-ml-pill">📍 {result.area}</span>
                <span className="cd-ml-pill">🌧 {result.weather}</span>
                <span className="cd-ml-pill">🚦 {result.traffic}</span>
              </div>

              <div className="cd-breakdown">
                <div className="cd-row"><span className="cd-row-key">Base Earnings</span><span className="cd-row-val">₹{result.base_earnings}</span></div>
                <div className="cd-row"><span className="cd-row-key">Weather Bonus</span><span className="cd-row-val pos">+₹{result.weather_bonus}</span></div>
                <div className="cd-row"><span className="cd-row-key">Traffic Bonus</span><span className="cd-row-val pos">+₹{result.traffic_bonus}</span></div>
                <div className="cd-row"><span className="cd-row-key">AI Delay Bonus</span><span className="cd-row-val pos">+₹{result.ai_delay_bonus}</span></div>
                <div className="cd-row"><span className="cd-row-key">Late Penalty</span><span className="cd-row-val neg">-₹{result.late_penalty}</span></div>
              </div>

              {/* AI risk data from ML model */}
              {(result.risk_score || result.delay_level) && (
                <div className="cd-ai-box">
                  <div className="cd-ai-title">🤖 AI Risk Assessment</div>
                  {result.risk_score    && <div className="cd-ai-row"><span className="cd-ai-key">Risk Score</span><span className="cd-ai-val">{result.risk_score}/100</span></div>}
                  {result.delay_level   && <div className="cd-ai-row"><span className="cd-ai-key">Delay Level</span><span className="cd-ai-val">{result.delay_level}</span></div>}
                  {result.trigger_type  && <div className="cd-ai-row"><span className="cd-ai-key">Trigger</span><span className="cd-ai-val">{result.trigger_type}</span></div>}
                  {result.payout_amount && <div className="cd-ai-row"><span className="cd-ai-key">Insurance Payout</span><span className="cd-ai-val" style={{color:"#4ade80"}}>₹{result.payout_amount}</span></div>}
                </div>
              )}

              <div className="cd-total">
                <span className="cd-total-key">Final Earnings</span>
                <span className="cd-total-val">₹{result.final_total_earnings}</span>
              </div>

              <div className="cd-redirect">
                <span className="cd-dot" />
                Redirecting to Earnings Dashboard…
              </div>
            </div>
          )}

          {/* Manual next if no result */}
          {!result && !loading && (
            <div style={{ textAlign:"right", marginTop:16 }}>
              <button onClick={() => router.push("/risk-map")}
                style={{ background:"transparent", border:"1px solid rgba(255,255,255,.1)", borderRadius:9, padding:"11px 20px", color:"#475569", fontFamily:"inherit", fontSize:13, cursor:"pointer", transition:"all .2s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#e8eaf0" }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#475569" }}>
                Skip to Risk Map →
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  )
}