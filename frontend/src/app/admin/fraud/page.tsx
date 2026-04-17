"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import API from "@/services/api"

// ── Types ─────────────────────────────────────────────────────────────────────
interface FraudCase {
  id: number
  payout_reference: string
  user_id: number
  disruption_type: string
  fraud_risk_level: "low" | "medium" | "high"
  fraud_score: number
  fraud_flags: string[]
  status: string
  final_payout_inr: number
  tentative_payout_inr: number
  manual_review_required: boolean
  created_at: string
  location?: string
  driver_name?: string
  severity_level?: string
}

interface FraudStats {
  total_claims: number
  high_risk_blocked: number
  medium_risk_held: number
  escalated_count: number
  low_risk_approved: number
  total_saved_inr: number
  fraud_rate_pct: number
  top_flag: string
  recent_actions: AuditEntry[]
}

interface AuditEntry {
  id?: number
  action: string
  admin_username: string
  previous_status?: string
  new_status?: string
  notes?: string
  payout_released?: number
  payout_ref?: string
  acted_at: string
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_STATS: FraudStats = {
  total_claims: 142, high_risk_blocked: 8, medium_risk_held: 17,
  escalated_count: 3, low_risk_approved: 117,
  total_saved_inr: 4820, fraud_rate_pct: 5.6, top_flag: "GPS_SPOOFING_DETECTED",
  recent_actions: [
    { action:"rejected",  admin_username:"admin", payout_ref:"PAY-000041", notes:"GPS coordinates clearly spoofed",       acted_at: new Date(Date.now()-1000*60*8).toISOString() },
    { action:"approved",  admin_username:"admin", payout_ref:"PAY-000038", payout_released:320, notes:"Verified via CCTV", acted_at: new Date(Date.now()-1000*60*45).toISOString() },
    { action:"escalated", admin_username:"admin", payout_ref:"PAY-000035", notes:"Unusual pattern, needs senior review",   acted_at: new Date(Date.now()-1000*60*120).toISOString() },
  ],
}

const MOCK_CASES: FraudCase[] = [
  { id:1, payout_reference:"PAY-000041", user_id:12, disruption_type:"extreme_rain",
    fraud_risk_level:"high", fraud_score:91, driver_name:"Arjun M.",
    fraud_flags:["GPS_SPOOFING_DETECTED","LOCATION_MISMATCH","CLAIM_OUTSIDE_RAIN_ZONE"],
    status:"rejected", final_payout_inr:0, tentative_payout_inr:480,
    manual_review_required:false, created_at: new Date(Date.now()-1000*60*32).toISOString(), location:"Velachery" },
  { id:2, payout_reference:"PAY-000038", user_id:27, disruption_type:"heavy_rain",
    fraud_risk_level:"high", fraud_score:85, driver_name:"Priya K.",
    fraud_flags:["DUPLICATE_CLAIM_SAME_EVENT","RAPID_MULTI_CLAIM"],
    status:"rejected", final_payout_inr:0, tentative_payout_inr:320,
    manual_review_required:false, created_at: new Date(Date.now()-1000*60*165).toISOString(), location:"Adyar" },
  { id:3, payout_reference:"PAY-000035", user_id:44, disruption_type:"severe_aqi",
    fraud_risk_level:"medium", fraud_score:62, driver_name:"Karthik R.",
    fraud_flags:["SPEED_ANOMALY_DETECTED","SUSPICIOUS_TIMING"],
    status:"held_for_review", final_payout_inr:0, tentative_payout_inr:210,
    manual_review_required:true, created_at: new Date(Date.now()-1000*60*60*18).toISOString(), location:"OMR" },
  { id:4, payout_reference:"PAY-000033", user_id:58, disruption_type:"extreme_rain",
    fraud_risk_level:"medium", fraud_score:54, driver_name:"Deepa S.",
    fraud_flags:["CLAIM_FREQUENCY_HIGH"],
    status:"held_for_review", final_payout_inr:0, tentative_payout_inr:155,
    manual_review_required:true, created_at: new Date(Date.now()-1000*60*60*27).toISOString(), location:"Tambaram" },
  { id:5, payout_reference:"PAY-000029", user_id:71, disruption_type:"road_closure",
    fraud_risk_level:"high", fraud_score:88, driver_name:"Murugan P.",
    fraud_flags:["GPS_SPOOFING_DETECTED","NO_ACTUAL_DISRUPTION_IN_ZONE"],
    status:"rejected", final_payout_inr:0, tentative_payout_inr:380,
    manual_review_required:false, created_at: new Date(Date.now()-1000*60*60*36).toISOString(), location:"T Nagar" },
  { id:6, payout_reference:"PAY-000024", user_id:83, disruption_type:"heavy_rain",
    fraud_risk_level:"medium", fraud_score:58, driver_name:"Lakshmi V.",
    fraud_flags:["VEHICLE_STOPPED_NO_RAIN_RECORD"],
    status:"escalated", final_payout_inr:0, tentative_payout_inr:190,
    manual_review_required:true, created_at: new Date(Date.now()-1000*60*60*48).toISOString(), location:"Porur" },
]

// ── Constants ─────────────────────────────────────────────────────────────────
const FLAG_META: Record<string, { label: string; color: string; icon: string }> = {
  GPS_SPOOFING_DETECTED:          { label:"GPS Spoofing",        color:"#f87171", icon:"📍" },
  LOCATION_MISMATCH:              { label:"Location Mismatch",   color:"#fb923c", icon:"🗺️" },
  DUPLICATE_CLAIM_SAME_EVENT:     { label:"Duplicate Claim",     color:"#f87171", icon:"📋" },
  RAPID_MULTI_CLAIM:              { label:"Rapid Multi-Claim",   color:"#fb923c", icon:"⚡" },
  SPEED_ANOMALY_DETECTED:         { label:"Speed Anomaly",       color:"#fbbf24", icon:"🏎️" },
  SUSPICIOUS_TIMING:              { label:"Suspicious Timing",   color:"#fbbf24", icon:"⏰" },
  CLAIM_FREQUENCY_HIGH:           { label:"High Frequency",      color:"#fbbf24", icon:"📈" },
  NO_ACTUAL_DISRUPTION_IN_ZONE:   { label:"No Disruption Found", color:"#f87171", icon:"🌤️" },
  CLAIM_OUTSIDE_RAIN_ZONE:        { label:"Outside Rain Zone",   color:"#fb923c", icon:"🌧️" },
  VEHICLE_STOPPED_NO_RAIN_RECORD: { label:"Stopped, No Rain",    color:"#fbbf24", icon:"🚗" },
  FRAUD_SPEED_WEATHER_MISMATCH:   { label:"Speed/Weather Mismatch", color:"#fb923c", icon:"🌀" },
  FRAUD_HIGH_CLAIM_VELOCITY_24H:  { label:"High Claim Velocity", color:"#f87171", icon:"⚡" },
  FRAUD_BORDERLINE_RISK_SCORE:    { label:"Borderline Score",    color:"#fbbf24", icon:"🎯" },
  FRAUD_TRAFFIC_CLAIM_INCONSISTENCY: { label:"Traffic Inconsistency", color:"#fb923c", icon:"🚦" },
  FRAUD_WEATHER_DATA_INCONSISTENCY:  { label:"Weather Inconsistency", color:"#f87171", icon:"🌩️" },
}

const RISK_STYLE = {
  high:   { color:"#f87171", bg:"rgba(239,68,68,.12)",  border:"rgba(239,68,68,.3)",   label:"HIGH RISK"   },
  medium: { color:"#fbbf24", bg:"rgba(251,191,36,.10)", border:"rgba(251,191,36,.28)", label:"MEDIUM RISK" },
  low:    { color:"#4ade80", bg:"rgba(74,222,128,.10)", border:"rgba(74,222,128,.28)", label:"LOW RISK"    },
}

const ACTION_STYLE: Record<string, { color: string; icon: string; label: string }> = {
  approved:  { color:"#4ade80", icon:"✓", label:"Approved" },
  rejected:  { color:"#f87171", icon:"✕", label:"Rejected" },
  escalated: { color:"#a78bfa", icon:"↑", label:"Escalated" },
}

const EMPTY_STATS: FraudStats = {
  total_claims:0, high_risk_blocked:0, medium_risk_held:0, escalated_count:0,
  low_risk_approved:0, total_saved_inr:0, fraud_rate_pct:0, top_flag:"—",
  recent_actions:[],
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  return `${Math.floor(diff/86400)}d ago`
}

function useCounter(target: number, duration = 1200) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / (duration / 16)
    const t = setInterval(() => {
      start = Math.min(start + step, target)
      setVal(Math.floor(start))
      if (start >= target) clearInterval(t)
    }, 16)
    return () => clearInterval(t)
  }, [target, duration])
  return val
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 28, circ = 2 * Math.PI * r
  const fill = circ * (1 - score / 100)
  const color = score >= 80 ? "#f87171" : score >= 50 ? "#fbbf24" : "#4ade80"
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" style={{flexShrink:0}}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="5"/>
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${circ}`} strokeDashoffset={fill} strokeLinecap="round"
        transform="rotate(-90 36 36)" style={{transition:"stroke-dashoffset 1s ease"}}/>
      <text x="36" y="40" textAnchor="middle" fill={color} fontSize="14"
        fontWeight="700" fontFamily="monospace">{score}</text>
    </svg>
  )
}

function GpsSpoofVisual() {
  return (
    <svg viewBox="0 0 120 90" style={{width:"100%",maxWidth:220,display:"block",margin:"0 auto"}}>
      {[0,30,60,90].map(y=>(
        <line key={y} x1="0" y1={y} x2="120" y2={y} stroke="rgba(255,255,255,.05)" strokeWidth=".5"/>
      ))}
      {[0,40,80,120].map(x=>(
        <line key={x} x1={x} y1="0" x2={x} y2="90" stroke="rgba(255,255,255,.05)" strokeWidth=".5"/>
      ))}
      <line x1="52" y1="58" x2="78" y2="32" stroke="rgba(248,113,113,.4)" strokeWidth="1" strokeDasharray="3,2"/>
      <circle cx="52" cy="58" r="6" fill="rgba(74,222,128,.2)" stroke="#4ade80" strokeWidth="1.5"/>
      <circle cx="52" cy="58" r="3" fill="#4ade80"/>
      <text x="52" y="72" textAnchor="middle" fill="#4ade80" fontSize="5.5" fontFamily="monospace">ACTUAL</text>
      <circle cx="78" cy="32" r="6" fill="rgba(248,113,113,.2)" stroke="#f87171" strokeWidth="1.5"/>
      <circle cx="78" cy="32" r="3" fill="#f87171">
        <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite"/>
      </circle>
      <text x="78" y="46" textAnchor="middle" fill="#f87171" fontSize="5.5" fontFamily="monospace">CLAIMED</text>
      <text x="65" y="42" textAnchor="middle" fill="rgba(248,113,113,.7)" fontSize="5" fontFamily="monospace">4.2km gap</text>
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function FraudDashboard() {
  const router = useRouter()

  const [cases,         setCases]         = useState<FraudCase[]>([])
  const [stats,         setStats]         = useState<FraudStats>(EMPTY_STATS)
  const [auditTrail,    setAuditTrail]    = useState<AuditEntry[]>([])
  const [selected,      setSelected]      = useState<FraudCase|null>(null)
  const [filter,        setFilter]        = useState<"all"|"high"|"medium"|"escalated">("all")
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [usingMock,     setUsingMock]     = useState(false)
  const [notes,         setNotes]         = useState("")
  const [notesError,    setNotesError]    = useState("")
  const [activeTab,     setActiveTab]     = useState<"detail"|"audit">("detail")
  const [lastRefresh,   setLastRefresh]   = useState<Date>(new Date())
  const [liveFeed,      setLiveFeed]      = useState<string[]>([])

  const savedCounter   = useCounter(stats.total_saved_inr)
  const blockedCounter = useCounter(stats.high_risk_blocked)

  // ── Auto-poll every 30 seconds ────────────────────────────────────────────
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [statsRes, casesRes] = await Promise.all([
        API.get("/admin/fraud/stats"),
        API.get("/admin/fraud/cases"),
      ])
      const realCases: FraudCase[] = casesRes.data || []
      const realStats: FraudStats  = statsRes.data  || EMPTY_STATS

      if (realCases.length === 0) {
        setCases(MOCK_CASES); setStats(MOCK_STATS); setUsingMock(true)
      } else {
        setCases(realCases); setStats(realStats); setUsingMock(false)
      }
      setLastRefresh(new Date())
    } catch {
      setCases(MOCK_CASES); setStats(MOCK_STATS); setUsingMock(true)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const t = setInterval(() => fetchAll(true), 30_000)
    return () => clearInterval(t)
  }, [fetchAll])

  // ── Fetch audit trail when case selected ─────────────────────────────────
  const fetchAudit = useCallback(async (id: number) => {
    if (usingMock) {
      setAuditTrail(MOCK_STATS.recent_actions.slice(0, 3))
      return
    }
    try {
      const res = await API.get(`/admin/fraud/${id}/audit`)
      setAuditTrail(res.data || [])
    } catch {
      setAuditTrail([])
    }
  }, [usingMock])

  const selectCase = (c: FraudCase) => {
    setSelected(c)
    setNotes("")
    setNotesError("")
    setActiveTab("detail")
    fetchAudit(c.id)
  }

  // ── Live feed ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (cases.length === 0) return
    const msgs = cases.slice(0, 7).map(c =>
      c.fraud_risk_level === "high"
        ? `🚨 ${(c.fraud_flags[0]||"Fraud").replace(/_/g," ")} — ${c.payout_reference} blocked`
        : `⚠️  ${(c.fraud_flags[0]||"Anomaly").replace(/_/g," ")} — ${c.payout_reference} held`
    )
    let i = 0
    setLiveFeed([msgs[0]])
    const t = setInterval(() => {
      i++
      setLiveFeed(prev => [msgs[i % msgs.length], ...prev].slice(0, 6))
    }, 2800)
    return () => clearInterval(t)
  }, [cases])

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleAction = async (id: number, action: "approve"|"reject"|"escalate") => {
    if (action === "escalate" && !notes.trim()) {
      setNotesError("Notes are required when escalating")
      return
    }
    setNotesError("")

    if (usingMock) {
      setCases(prev => prev.map(c =>
        c.id === id
          ? { ...c, status: action === "approve" ? "approved" : action === "reject" ? "rejected" : "escalated",
              manual_review_required: false }
          : c
      ))
      setAuditTrail(prev => [{
        action, admin_username:"admin",
        notes: notes || undefined,
        payout_released: action === "approve" ? (selected?.tentative_payout_inr || 0) : undefined,
        acted_at: new Date().toISOString(),
      }, ...prev])
      if (action !== "escalate") setSelected(null)
      setNotes("")
      return
    }

    setActionLoading(true)
    try {
      await API.patch(`/admin/fraud/${id}/${action}`, { notes: notes || null })
      await fetchAll()
      if (action !== "escalate") setSelected(null)
      else fetchAudit(id)
      setNotes("")
    } catch (e: any) {
      setNotesError(e?.response?.data?.detail || `Failed to ${action}`)
    } finally {
      setActionLoading(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = cases.filter(c => {
    if (filter === "all")       return true
    if (filter === "escalated") return c.status === "escalated"
    return c.fraud_risk_level === filter
  })

  const flagCounts: Record<string, number> = {}
  cases.forEach(c => c.fraud_flags?.forEach(f => {
    flagCounts[f] = (flagCounts[f] || 0) + 1
  }))
  const topFlags = Object.entries(flagCounts).sort((a,b) => b[1]-a[1]).slice(0,5)

  const canAct = selected &&
    (selected.status === "held_for_review" || selected.status === "escalated")

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .fd{min-height:100vh;background:#080a0e;color:#e2e8f0;font-family:'DM Sans',sans-serif;
          background-image:radial-gradient(ellipse 60% 40% at 20% 0%,rgba(239,68,68,.06) 0%,transparent 60%),
          radial-gradient(ellipse 40% 30% at 80% 100%,rgba(167,139,250,.04) 0%,transparent 60%);}
        .fd-inner{max-width:1300px;margin:0 auto;padding:36px 24px 80px;}
        .fd-head{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:40px;flex-wrap:wrap;gap:16px;}
        .fd-eyebrow{font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#ef4444;margin-bottom:8px;display:flex;align-items:center;gap:6px;}
        .fd-pulse{width:7px;height:7px;border-radius:50%;background:#ef4444;animation:fdPulse 1.5s ease infinite;display:inline-block;}
        .fd-title{font-family:'Bebas Neue',sans-serif;font-size:clamp(36px,5vw,60px);letter-spacing:.04em;line-height:.95;color:#fff;}
        .fd-title span{color:#ef4444;}
        .fd-sub{font-size:14px;color:#475569;margin-top:8px;}
        .fd-meta{display:flex;gap:12px;align-items:center;margin-top:8px;flex-wrap:wrap;}
        .fd-mock-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);border-radius:100px;font-size:11px;color:#fbbf24;font-weight:600;}
        .fd-refresh-info{font-size:11px;color:#334155;font-family:'DM Mono',monospace;}
        .fd-btn{padding:10px 18px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#64748b;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .2s;}
        .fd-btn:hover{background:rgba(255,255,255,.07);color:#94a3b8;}
        .fd-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:32px;}
        .fd-stat{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:20px;position:relative;overflow:hidden;animation:fdUp .5s ease both;}
        .fd-stat::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;}
        .fd-stat.red::before{background:linear-gradient(90deg,#ef4444,transparent);}
        .fd-stat.amber::before{background:linear-gradient(90deg,#f59e0b,transparent);}
        .fd-stat.purple::before{background:linear-gradient(90deg,#a78bfa,transparent);}
        .fd-stat.green::before{background:linear-gradient(90deg,#22c55e,transparent);}
        .fd-stat.blue::before{background:linear-gradient(90deg,#3b82f6,transparent);}
        .fd-stat-val{font-family:'Bebas Neue',sans-serif;font-size:38px;letter-spacing:.03em;line-height:1;}
        .fd-stat-key{font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:.1em;margin-top:4px;}
        .fd-stat-sub{font-size:12px;margin-top:8px;font-family:'DM Mono',monospace;}
        .fd-grid{display:grid;grid-template-columns:1fr 360px;gap:20px;margin-bottom:20px;}
        .fd-panel{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden;}
        .fd-panel-head{padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
        .fd-panel-title{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#475569;}
        .fd-tabs{display:flex;gap:6px;flex-wrap:wrap;}
        .fd-tab{padding:5px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid transparent;transition:all .2s;font-family:'DM Sans',sans-serif;}
        .fd-tab.active-all{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.12);color:#e2e8f0;}
        .fd-tab.active-high{background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.3);color:#f87171;}
        .fd-tab.active-medium{background:rgba(251,191,36,.1);border-color:rgba(251,191,36,.28);color:#fbbf24;}
        .fd-tab.active-escalated{background:rgba(167,139,250,.1);border-color:rgba(167,139,250,.28);color:#a78bfa;}
        .fd-tab:not([class*="active"]){color:#334155;}
        .fd-tab:not([class*="active"]):hover{color:#64748b;background:rgba(255,255,255,.04);}
        .fd-case{padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.05);display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;cursor:pointer;transition:background .15s;border-left:2px solid transparent;}
        .fd-case:last-child{border-bottom:none;}
        .fd-case:hover{background:rgba(255,255,255,.03);}
        .fd-case.active{background:rgba(239,68,68,.04);border-left-color:#ef4444;}
        .fd-case.escalated-row{border-left-color:#a78bfa;}
        .fd-case-name{font-size:13px;font-weight:500;color:#cbd5e1;}
        .fd-case-ref{font-family:'DM Mono',monospace;font-size:11px;color:#334155;}
        .fd-case-loc{font-size:11px;color:#475569;margin-top:2px;}
        .fd-flag-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
        .fd-risk-badge{font-size:10px;font-weight:700;letter-spacing:.1em;padding:3px 8px;border-radius:100px;white-space:nowrap;}
        .fd-time{font-size:11px;color:#334155;font-family:'DM Mono',monospace;white-space:nowrap;}
        .fd-panel-body{padding:16px;}
        .fd-detail{display:flex;flex-direction:column;gap:16px;}
        .fd-detail-empty{display:flex;align-items:center;justify-content:center;height:300px;color:#334155;font-size:13px;padding:40px;text-align:center;}
        .fd-detail-ref{font-family:'DM Mono',monospace;font-size:11px;color:#475569;}
        .fd-detail-name{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:.04em;color:#fff;margin-top:2px;}
        .fd-detail-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px;}
        .fd-detail-row:last-child{border-bottom:none;}
        .fd-detail-key{color:#475569;text-transform:uppercase;letter-spacing:.08em;font-size:10px;}
        .fd-detail-val{color:#cbd5e1;font-family:'DM Mono',monospace;font-size:11px;}
        .fd-flags-list{display:flex;flex-direction:column;gap:6px;}
        .fd-flag-item{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;font-size:12px;}
        .fd-section-label{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#475569;margin-bottom:8px;}
        .fd-notes-area{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:10px 12px;color:#e2e8f0;font-size:12px;font-family:'DM Sans',sans-serif;resize:vertical;min-height:68px;outline:none;transition:border-color .2s;}
        .fd-notes-area:focus{border-color:rgba(255,255,255,.2);}
        .fd-notes-area.error{border-color:rgba(239,68,68,.4);}
        .fd-notes-error{font-size:11px;color:#f87171;margin-top:4px;}
        .fd-action-btns{display:flex;gap:8px;}
        .fd-action-btn{flex:1;padding:10px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all .2s;}
        .fd-action-btn:disabled{opacity:.5;cursor:not-allowed;}
        .fd-action-btn.approve{background:rgba(34,197,94,.12);color:#4ade80;border:1px solid rgba(34,197,94,.25);}
        .fd-action-btn.approve:hover:not(:disabled){background:rgba(34,197,94,.2);}
        .fd-action-btn.reject{background:rgba(239,68,68,.12);color:#f87171;border:1px solid rgba(239,68,68,.25);}
        .fd-action-btn.reject:hover:not(:disabled){background:rgba(239,68,68,.2);}
        .fd-action-btn.escalate{background:rgba(167,139,250,.1);color:#a78bfa;border:1px solid rgba(167,139,250,.25);}
        .fd-action-btn.escalate:hover:not(:disabled){background:rgba(167,139,250,.18);}
        .fd-readonly-notice{padding:10px 12px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);font-size:11px;color:#475569;text-align:center;}
        .fd-audit-entry{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);}
        .fd-audit-entry:last-child{border-bottom:none;}
        .fd-audit-dot{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:1px;}
        .fd-audit-body{flex:1;min-width:0;}
        .fd-audit-action{font-size:12px;font-weight:600;}
        .fd-audit-admin{font-size:11px;color:#475569;margin-top:1px;}
        .fd-audit-notes{font-size:11px;color:#64748b;margin-top:4px;font-style:italic;}
        .fd-audit-time{font-size:10px;color:#334155;font-family:'DM Mono',monospace;white-space:nowrap;}
        .fd-detail-tabs{display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,.06);margin:-16px -16px 16px;}
        .fd-detail-tab{flex:1;padding:10px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;border:none;background:transparent;color:#334155;font-family:'DM Sans',sans-serif;transition:all .2s;border-bottom:2px solid transparent;}
        .fd-detail-tab.active{color:#e2e8f0;border-bottom-color:#ef4444;}
        .fd-detail-tab:hover:not(.active){color:#64748b;}
        .fd-tentative{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.15);border-radius:8px;}
        .fd-tentative-label{font-size:10px;color:#fbbf24;text-transform:uppercase;letter-spacing:.08em;}
        .fd-tentative-val{font-family:'Bebas Neue',sans-serif;font-size:20px;color:#fbbf24;letter-spacing:.04em;}
        .fd-bottom{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;}
        .fd-gps-inner{padding:20px;display:flex;flex-direction:column;align-items:center;gap:12px;}
        .fd-gps-label{font-size:11px;color:#475569;text-align:center;}
        .fd-flag-bar-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);}
        .fd-flag-bar-row:last-child{border-bottom:none;}
        .fd-flag-bar-label{font-size:11px;color:#94a3b8;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .fd-flag-bar-track{flex:2;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;}
        .fd-flag-bar-fill{height:100%;border-radius:2px;transition:width 1s ease;}
        .fd-flag-bar-count{font-size:11px;color:#475569;font-family:'DM Mono',monospace;width:16px;text-align:right;}
        .fd-feed-item{padding:8px 12px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);font-size:11px;font-family:'DM Mono',monospace;animation:fdFeed .4s ease both;}
        .fd-loading{display:flex;align-items:center;justify-content:center;padding:60px;color:#334155;gap:12px;}
        .fd-spin{width:20px;height:20px;border:2px solid rgba(239,68,68,.2);border-top-color:#ef4444;border-radius:50%;animation:fdSpin .7s linear infinite;}
        @keyframes fdPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
        @keyframes fdUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fdFeed{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
        @keyframes fdSpin{to{transform:rotate(360deg)}}
        @media(max-width:1000px){.fd-stats{grid-template-columns:repeat(3,1fr);}.fd-grid{grid-template-columns:1fr;}.fd-bottom{grid-template-columns:1fr;}}
        @media(max-width:600px){.fd-stats{grid-template-columns:repeat(2,1fr);}}
      `}</style>

      <div className="fd">
        <div className="fd-inner">

          {/* Header */}
          <div className="fd-head">
            <div>
              <div className="fd-eyebrow"><span className="fd-pulse"/>Live Fraud Intelligence</div>
              <h1 className="fd-title">Fraud <span>Detection</span><br/>Panel</h1>
              <p className="fd-sub">Real-time anomaly detection · GPS validation · Claim integrity</p>
              <div className="fd-meta">
                {usingMock && <div className="fd-mock-badge">⚠️ Demo data</div>}
                <span className="fd-refresh-info">
                  Auto-refresh every 30s · Last: {lastRefresh.toLocaleTimeString()}
                </span>
              </div>
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <button className="fd-btn" onClick={() => fetchAll()}
                style={{color:"#f97316",borderColor:"rgba(249,115,22,.25)"}}>
                ↻ Refresh
              </button>
              <button className="fd-btn" onClick={() => router.push("/admin/dashboard")}>
                ← Dashboard
              </button>
            </div>
          </div>

          {/* Stats — 5 cards now */}
          <div className="fd-stats">
            {[
              { cls:"red",    val:blockedCounter,        key:"High Risk Blocked",  sub:"₹0 paid out",             color:"#f87171" },
              { cls:"amber",  val:stats.medium_risk_held,key:"Held for Review",   sub:"Manual check needed",      color:"#fbbf24" },
              { cls:"purple", val:stats.escalated_count, key:"Escalated",         sub:"Senior review needed",     color:"#a78bfa" },
              { cls:"green",  val:`₹${savedCounter.toLocaleString()}`, key:"Total Saved", sub:"Fraud prevented", color:"#4ade80" },
              { cls:"blue",   val:`${stats.fraud_rate_pct}%`, key:"Fraud Rate",  sub:`of ${stats.total_claims} claims`, color:"#60a5fa" },
            ].map(({ cls, val, key, sub, color }, i) => (
              <div key={key} className={`fd-stat ${cls}`} style={{ animationDelay: `${(i+1)*.1}s` }}>
                <div className="fd-stat-val" style={{ color }}>{val}</div>
                <div className="fd-stat-key">{key}</div>
                <div className="fd-stat-sub" style={{ color }}>{sub}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="fd-loading"><span className="fd-spin"/>Loading fraud data…</div>
          ) : (
            <>
              <div className="fd-grid">

                {/* Case list */}
                <div className="fd-panel">
                  <div className="fd-panel-head">
                    <span className="fd-panel-title">Flagged Claims</span>
                    <div className="fd-tabs">
                      {([
                        ["all",       `All (${cases.length})`],
                        ["high",      `High (${cases.filter(c=>c.fraud_risk_level==="high").length})`],
                        ["medium",    `Review (${cases.filter(c=>c.fraud_risk_level==="medium").length})`],
                        ["escalated", `Escalated (${cases.filter(c=>c.status==="escalated").length})`],
                      ] as const).map(([f, label]) => (
                        <button key={f}
                          className={`fd-tab${filter===f ? ` active-${f}` : ""}`}
                          onClick={() => setFilter(f)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filtered.length === 0 ? (
                    <div style={{padding:"40px",textAlign:"center",color:"#334155",fontSize:13}}>
                      No cases in this category
                    </div>
                  ) : filtered.map(c => {
                    const rs = RISK_STYLE[c.fraud_risk_level] || RISK_STYLE.medium
                    const isEscalated = c.status === "escalated"
                    return (
                      <div key={c.id}
                        className={`fd-case${selected?.id===c.id ? " active" : ""}${isEscalated ? " escalated-row" : ""}`}
                        onClick={() => selectCase(c)}>
                        <ScoreRing score={c.fraud_score}/>
                        <div style={{minWidth:0}}>
                          <div className="fd-case-name">{c.driver_name || `User #${c.user_id}`}</div>
                          <div className="fd-case-ref">{c.payout_reference}</div>
                          <div className="fd-case-loc">
                            {c.location && `${c.location} · `}
                            {c.disruption_type?.replace(/_/g," ")}
                          </div>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>
                            {c.fraud_flags?.slice(0,4).map(f => (
                              <span key={f} className="fd-flag-dot"
                                style={{background:FLAG_META[f]?.color||"#475569"}}
                                title={FLAG_META[f]?.label||f}/>
                            ))}
                            {(c.fraud_flags?.length||0) > 4 &&
                              <span style={{fontSize:10,color:"#475569"}}>+{c.fraud_flags.length-4}</span>}
                          </div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                          {isEscalated
                            ? <span className="fd-risk-badge"
                                style={{background:"rgba(167,139,250,.1)",border:"1px solid rgba(167,139,250,.25)",color:"#a78bfa"}}>
                                ↑ ESCALATED
                              </span>
                            : <span className="fd-risk-badge"
                                style={{background:rs.bg,border:`1px solid ${rs.border}`,color:rs.color}}>
                                {rs.label}
                              </span>
                          }
                          <span className="fd-time">{c.created_at ? timeAgo(c.created_at) : "—"}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Detail / Audit panel */}
                <div className="fd-panel">
                  <div className="fd-panel-head">
                    <span className="fd-panel-title">
                      {selected ? selected.payout_reference : "Case Detail"}
                    </span>
                    {selected &&
                      <span style={{fontSize:10,color:"#334155",fontFamily:"'DM Mono',monospace"}}>
                        Score: {selected.fraud_score}/100
                      </span>}
                  </div>

                  {!selected ? (
                    <div className="fd-detail-empty">
                      Select a flagged claim<br/>to inspect and act
                    </div>
                  ) : (
                    <div className="fd-panel-body">
                      {/* Sub-tabs: Detail | Audit Trail */}
                      <div className="fd-detail-tabs">
                        <button className={`fd-detail-tab${activeTab==="detail" ? " active" : ""}`}
                          onClick={() => setActiveTab("detail")}>
                          Detail
                        </button>
                        <button className={`fd-detail-tab${activeTab==="audit" ? " active" : ""}`}
                          onClick={() => setActiveTab("audit")}>
                          Audit Trail {auditTrail.length > 0 && `(${auditTrail.length})`}
                        </button>
                      </div>

                      {activeTab === "detail" ? (
                        <div className="fd-detail">
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                            <div>
                              <div className="fd-detail-ref">{selected.payout_reference}</div>
                              <div className="fd-detail-name">{selected.driver_name || `User #${selected.user_id}`}</div>
                            </div>
                            <ScoreRing score={selected.fraud_score}/>
                          </div>

                          {/* Tentative payout amount */}
                          {selected.tentative_payout_inr > 0 && (
                            <div className="fd-tentative">
                              <span className="fd-tentative-label">Tentative Payout</span>
                              <span className="fd-tentative-val">₹{selected.tentative_payout_inr.toLocaleString()}</span>
                            </div>
                          )}

                          <div style={{background:"rgba(255,255,255,.02)",borderRadius:10,padding:"4px 12px"}}>
                            {[
                              ["User ID",    `#${selected.user_id}`],
                              ["Zone",       selected.location || "—"],
                              ["Event",      selected.disruption_type?.replace(/_/g," ") || "—"],
                              ["Severity",   selected.severity_level || "—"],
                              ["Risk Level", selected.fraud_risk_level?.toUpperCase()],
                              ["Status",     selected.status?.replace(/_/g," ").toUpperCase()],
                            ].map(([k, v]) => (
                              <div key={k} className="fd-detail-row">
                                <span className="fd-detail-key">{k}</span>
                                <span className="fd-detail-val">{v}</span>
                              </div>
                            ))}
                          </div>

                          {/* Fraud flags */}
                          <div>
                            <div className="fd-section-label">Fraud Flags Detected</div>
                            <div className="fd-flags-list">
                              {selected.fraud_flags?.map(f => {
                                const meta = FLAG_META[f] || { label:f, color:"#64748b", icon:"⚠️" }
                                return (
                                  <div key={f} className="fd-flag-item"
                                    style={{background:`${meta.color}12`,border:`1px solid ${meta.color}30`}}>
                                    <span>{meta.icon}</span>
                                    <span style={{color:meta.color,fontWeight:500}}>{meta.label}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* Action panel */}
                          {canAct ? (
                            <div>
                              <div className="fd-section-label">Admin Action</div>
                              <textarea
                                className={`fd-notes-area${notesError ? " error" : ""}`}
                                placeholder="Add notes (required for escalation, optional for approve/reject)…"
                                value={notes}
                                onChange={e => { setNotes(e.target.value); setNotesError("") }}
                              />
                              {notesError && <div className="fd-notes-error">{notesError}</div>}
                              <div className="fd-action-btns" style={{marginTop:8}}>
                                <button className="fd-action-btn approve" disabled={actionLoading}
                                  onClick={() => handleAction(selected.id, "approve")}>
                                  {actionLoading ? "…" : "✓ Approve"}
                                </button>
                                <button className="fd-action-btn reject" disabled={actionLoading}
                                  onClick={() => handleAction(selected.id, "reject")}>
                                  {actionLoading ? "…" : "✕ Reject"}
                                </button>
                                <button className="fd-action-btn escalate" disabled={actionLoading}
                                  onClick={() => handleAction(selected.id, "escalate")}>
                                  {actionLoading ? "…" : "↑ Escalate"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="fd-readonly-notice">
                              This case is <strong style={{color:"#e2e8f0"}}>
                                {selected.status.replace(/_/g," ")}
                              </strong> — no further action available
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Audit Trail tab */
                        <div>
                          {auditTrail.length === 0 ? (
                            <div style={{padding:"40px 0",textAlign:"center",color:"#334155",fontSize:12}}>
                              No admin actions recorded yet
                            </div>
                          ) : auditTrail.map((entry, i) => {
                            const ast = ACTION_STYLE[entry.action] || { color:"#64748b", icon:"·", label:entry.action }
                            return (
                              <div key={i} className="fd-audit-entry">
                                <div className="fd-audit-dot"
                                  style={{background:`${ast.color}18`,color:ast.color,border:`1px solid ${ast.color}30`}}>
                                  {ast.icon}
                                </div>
                                <div className="fd-audit-body">
                                  <div className="fd-audit-action" style={{color:ast.color}}>
                                    {ast.label}
                                    {entry.payout_released && entry.payout_released > 0 &&
                                      <span style={{color:"#4ade80",marginLeft:8,fontSize:11}}>
                                        ₹{entry.payout_released.toLocaleString()} released
                                      </span>}
                                  </div>
                                  <div className="fd-audit-admin">by {entry.admin_username}</div>
                                  {entry.notes && <div className="fd-audit-notes">"{entry.notes}"</div>}
                                </div>
                                <div className="fd-audit-time">{timeAgo(entry.acted_at)}</div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom row */}
              <div className="fd-bottom">
                <div className="fd-panel">
                  <div className="fd-panel-head">
                    <span className="fd-panel-title">GPS Spoofing Detection</span>
                    <span style={{fontSize:10,color:"#f87171",fontFamily:"'DM Mono',monospace"}}>ACTIVE</span>
                  </div>
                  <div className="fd-gps-inner">
                    <GpsSpoofVisual/>
                    <p className="fd-gps-label">
                      Claimed pickup is <strong style={{color:"#f87171"}}>4.2km</strong> from
                      actual GPS — automatically blocked.
                    </p>
                    <div style={{display:"flex",gap:16,marginTop:4}}>
                      {[
                        ["Spoofs Caught", cases.filter(c=>c.fraud_flags?.includes("GPS_SPOOFING_DETECTED")).length, "#f87171"],
                        ["Auto-blocked",  "100%", "#4ade80"],
                      ].map(([k,v,c]) => (
                        <div key={String(k)} style={{textAlign:"center"}}>
                          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:c as string}}>{v}</div>
                          <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:".08em"}}>{k}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="fd-panel">
                  <div className="fd-panel-head">
                    <span className="fd-panel-title">Top Fraud Signals</span>
                  </div>
                  <div className="fd-panel-body">
                    {topFlags.map(([flag, count]) => {
                      const meta = FLAG_META[flag] || { label:flag, color:"#64748b", icon:"⚠️" }
                      const pct  = Math.round((count / topFlags[0][1]) * 100)
                      return (
                        <div key={flag} className="fd-flag-bar-row">
                          <span style={{fontSize:14}}>{meta.icon}</span>
                          <span className="fd-flag-bar-label">{meta.label}</span>
                          <div className="fd-flag-bar-track">
                            <div className="fd-flag-bar-fill" style={{width:`${pct}%`,background:meta.color}}/>
                          </div>
                          <span className="fd-flag-bar-count">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Recent admin actions */}
                <div className="fd-panel">
                  <div className="fd-panel-head">
                    <span className="fd-panel-title">Recent Admin Actions</span>
                    <span className="fd-pulse"/>
                  </div>
                  <div className="fd-panel-body" style={{display:"flex",flexDirection:"column",gap:0}}>
                    {stats.recent_actions.length === 0
                      ? liveFeed.map((msg, i) => (
                          <div key={i} className="fd-feed-item" style={{marginBottom:6,
                            color: msg.startsWith("🚨")?"#f87171":msg.startsWith("⚠️")?"#fbbf24":"#4ade80",
                            borderColor: msg.startsWith("🚨")?"rgba(239,68,68,.15)":msg.startsWith("⚠️")?"rgba(251,191,36,.15)":"rgba(34,197,94,.12)",
                          }}>{msg}</div>
                        ))
                      : stats.recent_actions.map((a, i) => {
                          const ast = ACTION_STYLE[a.action] || { color:"#64748b", icon:"·", label:a.action }
                          return (
                            <div key={i} className="fd-audit-entry">
                              <div className="fd-audit-dot"
                                style={{background:`${ast.color}18`,color:ast.color,border:`1px solid ${ast.color}30`}}>
                                {ast.icon}
                              </div>
                              <div className="fd-audit-body">
                                <div className="fd-audit-action" style={{color:ast.color,fontSize:11}}>
                                  {ast.label} · <span style={{color:"#475569",fontWeight:400}}>{a.payout_ref}</span>
                                </div>
                                <div className="fd-audit-admin">by {a.admin_username}</div>
                                {a.notes && <div className="fd-audit-notes">"{a.notes}"</div>}
                              </div>
                              <div className="fd-audit-time">{timeAgo(a.acted_at)}</div>
                            </div>
                          )
                        })
                    }
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}