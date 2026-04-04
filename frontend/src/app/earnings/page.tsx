"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import EarningsChart from "@/components/EarningsChart"
import API from "@/services/api"

interface EarningsRecord {
  id: number
  deliveries_completed: number
  distance_travelled: number
  weather_bonus: number
  traffic_bonus: number
  insurance_bonus: number
  total_earnings: number
}

// ── Platform display config ───────────────────────────────────────────────────
const PLATFORM_META: Record<string, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  zomato:  { label:"Zomato",           color:"#f87171", bg:"rgba(239,68,68,.10)",   border:"rgba(239,68,68,.25)",   emoji:"🔴" },
  swiggy:  { label:"Swiggy",           color:"#fb923c", bg:"rgba(249,115,22,.10)",  border:"rgba(249,115,22,.25)",  emoji:"🟠" },
  zepto:   { label:"Zepto",            color:"#a78bfa", bg:"rgba(167,139,250,.10)", border:"rgba(167,139,250,.25)", emoji:"🟣" },
  blinkit: { label:"Blinkit",          color:"#fbbf24", bg:"rgba(251,191,36,.10)",  border:"rgba(251,191,36,.25)",  emoji:"🟡" },
  dunzo:   { label:"Dunzo",            color:"#60a5fa", bg:"rgba(96,165,250,.10)",  border:"rgba(96,165,250,.25)",  emoji:"🔵" },
  both:    { label:"Zomato + Swiggy",  color:"#fb923c", bg:"rgba(249,115,22,.10)",  border:"rgba(249,115,22,.25)",  emoji:"🔴🟠" },
  other:   { label:"Platform Partner", color:"#94a3b8", bg:"rgba(148,163,184,.10)", border:"rgba(148,163,184,.25)", emoji:"🛵" },
}

// ── Zone daily order estimates ────────────────────────────────────────────────
const ZONE_ORDERS: Record<string, { avg_daily_orders: number; avg_order_value: number }> = {
  velachery:   { avg_daily_orders: 18, avg_order_value: 280 },
  adyar:       { avg_daily_orders: 20, avg_order_value: 380 },
  t_nagar:     { avg_daily_orders: 22, avg_order_value: 350 },
  omr:         { avg_daily_orders: 15, avg_order_value: 420 },
  anna_nagar:  { avg_daily_orders: 20, avg_order_value: 310 },
  porur:       { avg_daily_orders: 14, avg_order_value: 260 },
  tambaram:    { avg_daily_orders: 16, avg_order_value: 240 },
  chromepet:   { avg_daily_orders: 13, avg_order_value: 220 },
  kodambakkam: { avg_daily_orders: 15, avg_order_value: 270 },
  perambur:    { avg_daily_orders: 12, avg_order_value: 210 },
  guindy:      { avg_daily_orders: 16, avg_order_value: 290 },
  default:     { avg_daily_orders: 15, avg_order_value: 280 },
}

export default function EarningsDashboard() {
  const router = useRouter()

  const [totalEarnings,   setTotalEarnings]   = useState(0)
  const [records,         setRecords]         = useState<EarningsRecord[]>([])
  const [loading,         setLoading]         = useState(true)
  const [totalDeliveries, setTotalDeliveries] = useState(0)
  const [totalDistance,   setTotalDistance]   = useState(0)
  const [weatherBonus,    setWeatherBonus]    = useState(0)
  const [trafficBonus,    setTrafficBonus]    = useState(0)
  const [insuranceBonus,  setInsuranceBonus]  = useState(0)

  // ── Persona state (from localStorage) ────────────────────────────────────
  const [platform, setPlatform] = useState("zomato")
  const [zone,     setZone]     = useState("default")

  useEffect(() => {
    fetchEarnings()
    const p = localStorage.getItem("user_platform") || "zomato"
    const z = localStorage.getItem("user_zone")     || "default"
    setPlatform(p.toLowerCase())
    setZone(z.toLowerCase())
  }, [])

  const fetchEarnings = async () => {
    try {
      const totalRes   = await API.get("/earnings/total")
      const historyRes = await API.get("/earnings/history")
      const data: EarningsRecord[] = (historyRes.data || []).slice(-20)
      setTotalEarnings(totalRes.data.total_earnings || 0)
      setRecords(data)
      let del=0, dist=0, wb=0, tb=0, ib=0
      data.forEach((r) => {
        del  += r.deliveries_completed || 0
        dist += r.distance_travelled   || 0
        wb   += r.weather_bonus        || 0
        tb   += r.traffic_bonus        || 0
        ib   += r.insurance_bonus      || 0
      })
      setTotalDeliveries(del); setTotalDistance(dist)
      setWeatherBonus(wb); setTrafficBonus(tb); setInsuranceBonus(ib)
    } catch (error) { console.error(error) }
    finally { setLoading(false) }
  }

  // ── Derived food delivery metrics ─────────────────────────────────────────
  const zoneData        = ZONE_ORDERS[zone] || ZONE_ORDERS["default"]
  const avgOrderValue   = zoneData.avg_order_value
  const avgDailyOrders  = zoneData.avg_daily_orders
  const estDailyIncome  = Math.round(avgDailyOrders * avgOrderValue * 0.08)
  const estWeeklyIncome = estDailyIncome * 6
  const recoveryPct     = estWeeklyIncome > 0
    ? Math.round((insuranceBonus / estWeeklyIncome) * 100)
    : 0

  const pm = PLATFORM_META[platform] || PLATFORM_META["other"]

  if (loading) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&display=swap');
        .ed-loading { min-height:100vh; background:#0a0c10; display:flex; align-items:center; justify-content:center; font-family:'DM Sans',sans-serif; color:#475569; font-size:14px; gap:12px; }
        .ed-spin { width:18px;height:18px;border:2px solid rgba(249,115,22,.2);border-top-color:#f97316;border-radius:50%;animation:eSpin .7s linear infinite; }
        @keyframes eSpin { to { transform:rotate(360deg) } }
      `}</style>
      <div className="ed-loading"><span className="ed-spin" />Loading earnings…</div>
    </>
  )

  const CARDS = [
    { label:"Total Earnings",   value:`₹${totalEarnings.toLocaleString()}`, icon:"💰", accent:"#f97316" },
    { label:"Total Deliveries", value:String(totalDeliveries),              icon:"📦", accent:"#3b82f6" },
    { label:"Total Distance",   value:`${totalDistance.toFixed(1)} km`,    icon:"📍", accent:"#8b5cf6" },
    { label:"Weather Bonus",    value:`₹${weatherBonus}`,                   icon:"🌧",  accent:"#06b6d4" },
    { label:"Traffic Bonus",    value:`₹${trafficBonus}`,                   icon:"🚦",  accent:"#f59e0b" },
    { label:"Insurance Payout", value:`₹${insuranceBonus}`,                 icon:"🛡",  accent:"#22c55e" },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

        .ed-root {
          min-height: 100vh;
          background-color: #0a0c10;
          background-image:
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(251,146,60,.09) 0%, transparent 70%),
            linear-gradient(180deg,#0a0c10 0%,#0f1318 100%);
          color: #e8eaf0; font-family: 'DM Sans',sans-serif;
        }

        .ed-inner { max-width: 1060px; margin: 0 auto; padding: 52px 24px 80px; }

        /* ── Flow ── */
        .ed-flow { display:flex; align-items:center; gap:0; margin-bottom:48px; overflow-x:auto; }
        .ed-flow-step { display:flex; align-items:center; gap:7px; font-size:11.5px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:#334155; white-space:nowrap; }
        .ed-flow-step.done   { color:#22c55e; }
        .ed-flow-step.active { color:#fb923c; }
        .ed-flow-num { width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700; }
        .ed-flow-step.done   .ed-flow-num { background:#22c55e; border-color:#22c55e; color:#0a0c10; }
        .ed-flow-step.active .ed-flow-num { background:#f97316; border-color:#f97316; color:#fff; }
        .ed-flow-arrow { width:24px; height:1px; background:rgba(255,255,255,.1); margin:0 7px; flex-shrink:0; }

        /* ── Header ── */
        .ed-top { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:36px; gap:16px; flex-wrap:wrap; }
        .ed-eyebrow { font-size:11px; font-weight:600; letter-spacing:.16em; text-transform:uppercase; color:#475569; margin-bottom:8px; }
        .ed-title { font-family:'Bebas Neue',sans-serif; font-size:clamp(42px,6vw,68px); letter-spacing:.04em; line-height:.95; }
        .ed-title span { background:linear-gradient(135deg,#fb923c,#fbbf24); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .ed-actions { display:flex; gap:10px; flex-wrap:wrap; }
        .ed-action { padding:10px 20px; border-radius:9px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all .2s; }
        .ed-action-primary { background:linear-gradient(135deg,#f97316,#ea580c); color:#fff; border:none; box-shadow:0 4px 16px rgba(249,115,22,.28); }
        .ed-action-primary:hover { transform:translateY(-1px); box-shadow:0 6px 22px rgba(249,115,22,.38); }
        .ed-action-ghost { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:#94a3b8; }
        .ed-action-ghost:hover { background:rgba(255,255,255,.09); color:#e8eaf0; }

        /* ── Persona banner ── */
        .ed-persona { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:16px 20px; margin-bottom:32px; }
        .ed-persona-left { display:flex; align-items:center; gap:14px; }
        .ed-persona-badge { padding:5px 12px; border-radius:100px; font-size:12px; font-weight:700; letter-spacing:.06em; }
        .ed-persona-zone { font-size:13px; color:#475569; }
        .ed-persona-zone span { color:#94a3b8; font-weight:500; text-transform:capitalize; }
        .ed-persona-right { display:flex; gap:20px; flex-wrap:wrap; }
        .ed-ps { text-align:right; }
        .ed-ps-val { font-family:'Bebas Neue',sans-serif; font-size:20px; letter-spacing:.03em; color:#e8eaf0; }
        .ed-ps-key { font-size:10px; color:#475569; text-transform:uppercase; letter-spacing:.08em; }

        /* ── Recovery bar ── */
        .ed-recovery { background:rgba(34,197,94,.05); border:1px solid rgba(34,197,94,.15); border-radius:14px; padding:16px 20px; margin-bottom:32px; display:flex; align-items:center; gap:20px; flex-wrap:wrap; }
        .ed-recovery-label { font-size:12px; color:#475569; flex:1; }
        .ed-recovery-val { font-family:'Bebas Neue',sans-serif; font-size:28px; letter-spacing:.03em; color:#4ade80; white-space:nowrap; }
        .ed-recovery-bar-wrap { flex:2; min-width:140px; }
        .ed-recovery-bar-track { height:6px; background:rgba(255,255,255,.07); border-radius:3px; overflow:hidden; }
        .ed-recovery-bar-fill { height:100%; border-radius:3px; background:linear-gradient(90deg,#22c55e,#4ade80); transition:width 1s ease; }

        /* ── Stat cards ── */
        .ed-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:48px; }
        .ed-card { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:20px 22px; display:flex; align-items:center; gap:14px; transition:all .2s; animation:edFadeUp .5s ease both; }
        .ed-card:nth-child(1){animation-delay:.05s} .ed-card:nth-child(2){animation-delay:.1s}  .ed-card:nth-child(3){animation-delay:.15s}
        .ed-card:nth-child(4){animation-delay:.2s}  .ed-card:nth-child(5){animation-delay:.25s} .ed-card:nth-child(6){animation-delay:.3s}
        .ed-card:hover { background:rgba(255,255,255,.05); border-color:rgba(255,255,255,.12); transform:translateY(-2px); }
        .ed-card-icon { width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
        .ed-card-label { font-size:11px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:#475569; margin-bottom:4px; }
        .ed-card-value { font-family:'Bebas Neue',sans-serif; font-size:24px; letter-spacing:.04em; color:#e8eaf0; line-height:1; }

        /* ── Section divider ── */
        .ed-section { font-size:11px; font-weight:600; letter-spacing:.16em; text-transform:uppercase; color:#475569; margin-bottom:16px; display:flex; align-items:center; gap:10px; }
        .ed-section::after { content:''; flex:1; height:1px; background:rgba(255,255,255,.06); }

        /* ── Records ── */
        .ed-records { display:flex; flex-direction:column; gap:8px; margin-bottom:48px; }
        .ed-record { background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.06); border-radius:12px; padding:16px 20px; display:grid; grid-template-columns:1fr 1fr 1fr 1fr 1fr auto; align-items:center; gap:10px; transition:all .2s; }
        .ed-record:hover { background:rgba(255,255,255,.04); border-color:rgba(255,255,255,.11); }
        .ed-rec-key { font-size:10px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:#334155; margin-bottom:3px; }
        .ed-rec-val { font-size:14px; font-weight:500; color:#94a3b8; }
        .ed-rec-total { font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:.03em; color:#4ade80; white-space:nowrap; }
        .ed-empty { text-align:center; padding:40px 0; color:#334155; font-size:14px; }

        /* ── Chart ── */
        .ed-chart-card { background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:24px; margin-bottom:40px; }

        /* ── Next button ── */
        .ed-next-bar { display:flex; justify-content:flex-end; }
        .ed-next-btn { padding:14px 36px; border-radius:10px; background:linear-gradient(135deg,#f97316,#ea580c); color:#fff; font-family:'DM Sans',sans-serif; font-size:15px; font-weight:600; border:none; cursor:pointer; box-shadow:0 4px 20px rgba(249,115,22,.28); transition:all .2s; }
        .ed-next-btn:hover { transform:translateY(-2px); box-shadow:0 8px 28px rgba(249,115,22,.4); }

        @keyframes edFadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }

        @media(max-width:700px) {
          .ed-grid   { grid-template-columns:1fr 1fr; }
          .ed-record { grid-template-columns:1fr 1fr; }
          .ed-persona-right { gap:12px; }
          .ed-ps { text-align:left; }
        }
        @media(max-width:460px) { .ed-grid { grid-template-columns:1fr; } }
      `}</style>

      <div className="ed-root">
        <Navbar />
        <div className="ed-inner">

          {/* ── Flow breadcrumb ── */}
          <div className="ed-flow">
            {[
              { n:"✓", l:"Login",    s:"done"   },
              { n:"✓", l:"Enroll",   s:"done"   },
              { n:"✓", l:"Pay",      s:"done"   },
              { n:"✓", l:"Policies", s:"done"   },
              { n:"5", l:"Earnings", s:"active" },
              { n:"6", l:"Delivery", s:""       },
              { n:"7", l:"Risk Map", s:""       },
            ].map((step, i, arr) => (
              <div key={step.l} style={{ display:"flex", alignItems:"center" }}>
                <div className={`ed-flow-step${step.s ? ` ${step.s}` : ""}`}>
                  <div className="ed-flow-num">{step.n}</div>{step.l}
                </div>
                {i < arr.length - 1 && <div className="ed-flow-arrow" />}
              </div>
            ))}
          </div>

          {/* ── Header ── */}
          <div className="ed-top">
            <div>
              <p className="ed-eyebrow">Step 5 of 7 — Income Overview</p>
              <h1 className="ed-title">Earnings<br /><span>Dashboard</span></h1>
            </div>
            <div className="ed-actions">
              <button className="ed-action ed-action-primary" onClick={() => router.push("/complete-delivery")}>
                + Complete Delivery
              </button>
              <button className="ed-action ed-action-ghost" onClick={fetchEarnings}>↻ Refresh</button>
            </div>
          </div>

          {/* ── Food Delivery Persona Banner ── */}
          <div className="ed-persona">
            <div className="ed-persona-left">
              <span
                className="ed-persona-badge"
                style={{ background: pm.bg, border: `1px solid ${pm.border}`, color: pm.color }}
              >
                {pm.emoji} {pm.label} Partner
              </span>
              <div className="ed-persona-zone">
                Zone: <span>{zone.replace("_", " ")}</span>
                &nbsp;·&nbsp;Food Delivery Partner
              </div>
            </div>
            <div className="ed-persona-right">
              <div className="ed-ps">
                <div className="ed-ps-val">~{avgDailyOrders}</div>
                <div className="ed-ps-key">Avg Orders/Day</div>
              </div>
              <div className="ed-ps">
                <div className="ed-ps-val">₹{avgOrderValue}</div>
                <div className="ed-ps-key">Avg Order Value</div>
              </div>
              <div className="ed-ps">
                <div className="ed-ps-val">₹{estDailyIncome}</div>
                <div className="ed-ps-key">Est. Daily Income</div>
              </div>
              <div className="ed-ps">
                <div className="ed-ps-val">₹{estWeeklyIncome}</div>
                <div className="ed-ps-key">Est. Weekly Income</div>
              </div>
            </div>
          </div>

          {/* ── Insurance Recovery Bar (only shown when payout exists) ── */}
          {insuranceBonus > 0 && (
            <div className="ed-recovery">
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:"#4ade80", marginBottom:4 }}>
                  🛡 Income Protected by GigShield
                </div>
                <div className="ed-recovery-label">
                  Your insurance payouts have recovered {recoveryPct}% of your estimated weekly income
                  during disruptions. Without GigShield, this income would have been lost.
                </div>
              </div>
              <div className="ed-recovery-val">+₹{insuranceBonus}</div>
              <div className="ed-recovery-bar-wrap">
                <div style={{ fontSize:10, color:"#475569", marginBottom:4, textAlign:"right" }}>
                  {recoveryPct}% recovered
                </div>
                <div className="ed-recovery-bar-track">
                  <div className="ed-recovery-bar-fill" style={{ width:`${Math.min(100, recoveryPct)}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* ── Stat cards ── */}
          <div className="ed-grid">
            {CARDS.map((c) => (
              <div key={c.label} className="ed-card">
                <div className="ed-card-icon"
                  style={{ background:`${c.accent}18`, border:`1px solid ${c.accent}30` }}>
                  {c.icon}
                </div>
                <div>
                  <div className="ed-card-label">{c.label}</div>
                  <div className="ed-card-value" style={{ color: c.accent }}>{c.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Delivery history ── */}
          <p className="ed-section">Delivery History</p>
          {records.length === 0 ? (
            <div className="ed-empty">No deliveries yet — complete your first run!</div>
          ) : (
            <div className="ed-records">
              {records.map((r) => (
                <div className="ed-record" key={r.id}>
                  <div><div className="ed-rec-key">Deliveries</div><div className="ed-rec-val">{r.deliveries_completed}</div></div>
                  <div><div className="ed-rec-key">Distance</div><div className="ed-rec-val">{r.distance_travelled} km</div></div>
                  <div><div className="ed-rec-key">Weather</div><div className="ed-rec-val">₹{r.weather_bonus}</div></div>
                  <div><div className="ed-rec-key">Traffic</div><div className="ed-rec-val">₹{r.traffic_bonus}</div></div>
                  <div><div className="ed-rec-key">Insurance</div><div className="ed-rec-val">₹{r.insurance_bonus}</div></div>
                  <div className="ed-rec-total">₹{r.total_earnings}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Chart ── */}
          <p className="ed-section">Earnings Trend</p>
          <div className="ed-chart-card">
            <EarningsChart data={records} />
          </div>

          <div className="ed-next-bar">
            <button className="ed-next-btn" onClick={() => router.push("/complete-delivery")}>
              Complete a Delivery →
            </button>
          </div>

        </div>
      </div>
    </>
  )
}