"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import API from "@/services/api"

interface Policy {
  id: number
  policy_name: string
  coverage_amount: number
  weekly_premium: number
}

interface Enrollment {
  id: number
  policy_id: number
  policy_tier: string
  weekly_premium_paid: number
  status: string
  start_date: string
  enrolled_at: string
  claims_this_week: number
  coverage_hours_used_this_week: number
  payout_total_this_week: number
  total_claims: number
  total_payout_received: number
  home_zone: string
}

interface ExclusionClause {
  code: string
  title: string
  category: string
  description: string
  examples: string[]
}

const TIER_META: Record<string, { color: string; glow: string; icon: string; tag: string; features: string[] }> = {
  basic:    { color:"#64748b", glow:"rgba(100,116,139,.25)", icon:"🌱", tag:"Starter",
              features:["₹500 max weekly payout","8 hrs/week coverage","2 claims per week","Rain + Heat triggers"] },
  standard: { color:"#f97316", glow:"rgba(249,115,22,.28)",  icon:"⚡", tag:"Popular",
              features:["₹1,200 max weekly payout","16 hrs/week coverage","3 claims per week","All disruption types","AQI + Curfew triggers"] },
  premium:  { color:"#a78bfa", glow:"rgba(167,139,250,.28)", icon:"💎", tag:"Best Value",
              features:["₹2,500 max weekly payout","30 hrs/week coverage","5 claims per week","All disruption types","Flood zone bonus hours","Instant UPI payout"] },
}

const MAX_HRS: Record<string, number> = { basic:8, standard:16, premium:30 }

const CAT_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  mandatory:   { label:"Mandatory",   color:"#f87171", bg:"rgba(239,68,68,.08)",   border:"rgba(239,68,68,.25)"  },
  regulatory:  { label:"Regulatory",  color:"#fbbf24", bg:"rgba(251,191,36,.08)",  border:"rgba(251,191,36,.25)" },
  operational: { label:"Operational", color:"#60a5fa", bg:"rgba(96,165,250,.08)",  border:"rgba(96,165,250,.25)" },
}

function getTier(name: string) {
  const n = (name||"").toLowerCase()
  return n.includes("premium") ? "premium" : n.includes("basic") ? "basic" : "standard"
}

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})
}

function statusStyle(s: string) {
  if (s==="active")    return { bg:"rgba(34,197,94,.1)",  bd:"rgba(34,197,94,.25)",  tx:"#4ade80" }
  if (s==="expired")   return { bg:"rgba(100,116,139,.1)",bd:"rgba(100,116,139,.25)",tx:"#94a3b8" }
  if (s==="cancelled") return { bg:"rgba(239,68,68,.1)",  bd:"rgba(239,68,68,.25)",  tx:"#f87171" }
  return                      { bg:"rgba(251,191,36,.1)", bd:"rgba(251,191,36,.25)", tx:"#fbbf24" }
}

// ── Week helpers ──────────────────────────────────────────────────────────────
function getWeekEnd(): Date {
  const now  = new Date()
  const day  = now.getDay()                        // 0=Sun … 6=Sat
  const diff = day === 0 ? 0 : 7 - day            // days until next Sunday midnight
  const end  = new Date(now)
  end.setDate(now.getDate() + diff)
  end.setHours(23, 59, 59, 999)
  return end
}

function useWeekCountdown() {
  const [remaining, setRemaining] = useState("")
  useEffect(() => {
    const tick = () => {
      const diff = getWeekEnd().getTime() - Date.now()
      if (diff <= 0) { setRemaining("Resetting…"); return }
      const d = Math.floor(diff / 86_400_000)
      const h = Math.floor((diff % 86_400_000) / 3_600_000)
      const m = Math.floor((diff % 3_600_000)  / 60_000)
      const s = Math.floor((diff % 60_000)      / 1_000)
      setRemaining(`${d}d ${h}h ${m}m ${s}s`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])
  return remaining
}

// ── Is enrolled THIS calendar week? ──────────────────────────────────────────
function enrolledThisWeek(enrollment: Enrollment | null): boolean {
  if (!enrollment || enrollment.status !== "active") return false
  const monday = new Date()
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  return new Date(enrollment.enrolled_at) >= monday
}

// ══════════════════════════════════════════════════════════════════════════════
export default function EnrollPolicy() {
  const router      = useRouter()
  const weekEnd     = useWeekCountdown()

  const [policies,    setPolicies]    = useState<Policy[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [active,      setActive]      = useState<Enrollment|null>(null)
  const [selected,    setSelected]    = useState<number|null>(null)
  const [loading,     setLoading]     = useState(true)
  const [histLoading, setHistLoading] = useState(true)
  const [enrolling,   setEnrolling]   = useState(false)
  const [justEnrolled,setJustEnrolled]= useState(false)

  const [exclusions,   setExclusions]   = useState<ExclusionClause[]>([])
  const [exOpen,       setExOpen]       = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  // Platform badge from login
  const [platform, setPlatform] = useState("zomato")
  useEffect(() => {
    const p = localStorage.getItem("user_platform") || "zomato"
    setPlatform(p.toLowerCase())
  }, [])

  useEffect(() => { fetchPolicies(); fetchHistory(); fetchExclusions() }, [])

  const fetchPolicies = async () => {
    try { const r = await API.get("/policy/all"); setPolicies(r.data) }
    catch { } finally { setLoading(false) }
  }

  const fetchHistory = async () => {
    setHistLoading(true)
    try {
      const r   = await API.get("/enrollment/history")
      const arr: Enrollment[] = Array.isArray(r.data) ? r.data : [r.data]
      setEnrollments(arr)
      setActive(arr.find(e => e.status === "active") || null)
    } catch {
      try {
        const r = await API.get("/enrollment/my-policy")
        if (r.data) { setEnrollments([r.data]); setActive(r.data.status==="active"?r.data:null) }
        else setEnrollments([])
      } catch { setEnrollments([]) }
    } finally { setHistLoading(false) }
  }

  const fetchExclusions = async () => {
    try {
      const r = await API.get("/policy/exclusions")
      setExclusions(r.data.flat_list || r.data.flat || [])
    } catch { }
  }

  const getPolicyName = (pid: number) =>
    policies.find(p => p.id === pid)?.policy_name || `Policy #${pid}`

  // ── ENROLL ────────────────────────────────────────────────────────────────
  const enroll = async (policyId: number) => {
    // Block if already enrolled this week
    if (enrolledThisWeek(active)) return

    setEnrolling(true)
    try {
      await API.post("/enrollment/enroll", { policy_id: policyId })
      await fetchHistory()
      setJustEnrolled(true)
      setTimeout(() => {
        router.push("/pay-premium")
      }, 1800)
    } catch (err: any) {
      const detail = err?.response?.data?.detail || ""
      if (detail.toLowerCase().includes("already") || err?.response?.status === 400) {
        await fetchHistory()   // refresh to show existing active policy
      }
    } finally {
      setEnrolling(false)
    }
  }

  const lockedThisWeek = enrolledThisWeek(active)

  const platformEmoji: Record<string,string> = {
    zomato:"🔴", swiggy:"🟠", zepto:"🟣", blinkit:"🟡", dunzo:"🔵", both:"🔴🟠", other:"🛵"
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        .ep-root{min-height:100vh;background-color:#0a0c10;background-image:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(251,146,60,.10) 0%,transparent 70%),linear-gradient(180deg,#0a0c10 0%,#0f1318 100%);color:#e8eaf0;font-family:'DM Sans',sans-serif;}
        .ep-inner{max-width:1060px;margin:0 auto;padding:52px 24px 80px;}
        .ep-flow{display:flex;align-items:center;gap:0;margin-bottom:48px;overflow-x:auto;}
        .ep-fs{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#334155;white-space:nowrap;}
        .ep-fs.done{color:#22c55e;} .ep-fs.active{color:#fb923c;}
        .ep-fn{width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;}
        .ep-fs.done .ep-fn{background:#22c55e;border-color:#22c55e;color:#0a0c10;}
        .ep-fs.active .ep-fn{background:#f97316;border-color:#f97316;color:#fff;}
        .ep-fa{width:24px;height:1px;background:rgba(255,255,255,.1);margin:0 7px;flex-shrink:0;}
        .ep-eyebrow{font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#475569;margin-bottom:10px;}
        .ep-title{font-family:'Bebas Neue',sans-serif;font-size:clamp(40px,6vw,64px);letter-spacing:.04em;line-height:.95;margin-bottom:12px;}
        .ep-title span{background:linear-gradient(135deg,#fb923c,#fbbf24);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
        .ep-sub{font-size:15px;color:#475569;margin-bottom:36px;}

        /* ── Active insurance card ── */
        .ep-active-card{background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2);border-radius:16px;padding:24px;margin-bottom:32px;animation:epUp .4s ease both;}
        .ep-active-header{display:flex;align-items:center;gap:12px;margin-bottom:16px;}
        .ep-active-dot{width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.6);animation:epPulse 1.5s ease infinite;flex-shrink:0;}
        .ep-active-title{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:.04em;color:#4ade80;}
        .ep-active-sub{font-size:12px;color:#475569;margin-left:auto;}
        .ep-active-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;}
        .ep-as{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:12px 14px;}
        .ep-as-val{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:.03em;color:#e8eaf0;}
        .ep-as-key{font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:.08em;margin-top:2px;}
        .ep-active-footer{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;}
        .ep-coverage-status{display:flex;align-items:center;gap:8px;font-size:13px;color:#4ade80;font-weight:500;}
        .ep-continue-btn{padding:10px 24px;border-radius:9px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(249,115,22,.28);transition:all .2s;}
        .ep-continue-btn:hover{transform:translateY(-1px);}

        /* ── Weekly lock banner ── */
        .ep-lock{background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.2);border-radius:12px;padding:14px 18px;margin-bottom:24px;display:flex;align-items:center;gap:12px;font-size:13px;color:#fbbf24;}
        .ep-lock-icon{font-size:18px;flex-shrink:0;}
        .ep-lock-time{font-family:'DM Mono',monospace;font-size:12px;color:#f97316;margin-left:auto;white-space:nowrap;}

        /* ── Success flash ── */
        .ep-success{position:fixed;bottom:24px;right:24px;background:#0f1318;border:1px solid rgba(34,197,94,.3);border-radius:12px;padding:14px 20px;display:flex;align-items:center;gap:10px;font-size:14px;font-weight:500;color:#4ade80;box-shadow:0 8px 32px rgba(0,0,0,.5);animation:epSlideUp .3s ease;z-index:999;}

        .ep-sec{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#475569;margin-bottom:14px;display:flex;align-items:center;gap:10px;}
        .ep-sec::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.06);}
        .ep-tbl-wrap{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden;margin-bottom:48px;}
        .ep-tbl{width:100%;border-collapse:collapse;}
        .ep-tbl th{text-align:left;padding:10px 14px;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#334155;border-bottom:1px solid rgba(255,255,255,.07);}
        .ep-tbl td{padding:13px 14px;font-size:13px;border-bottom:1px solid rgba(255,255,255,.05);color:#94a3b8;vertical-align:middle;}
        .ep-tbl tr:last-child td{border-bottom:none;}
        .ep-tbl tr:hover td{background:rgba(255,255,255,.025);}
        .ep-pill{display:inline-flex;align-items:center;padding:3px 9px;border-radius:100px;font-size:11px;font-weight:600;}
        .ep-bar{height:4px;background:rgba(255,255,255,.08);border-radius:2px;width:72px;overflow:hidden;display:inline-block;vertical-align:middle;margin-right:6px;}
        .ep-bar-fill{height:100%;border-radius:2px;}
        .ep-empty{text-align:center;padding:32px 0;color:#334155;font-size:14px;}

        .ep-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:16px;}
        .ep-card{position:relative;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:28px 24px;cursor:pointer;transition:all .25s;overflow:hidden;animation:epUp .5s ease both;}
        .ep-card:nth-child(1){animation-delay:.1s}.ep-card:nth-child(2){animation-delay:.2s}.ep-card:nth-child(3){animation-delay:.3s}
        .ep-card:hover:not(.ep-dim):not(.ep-locked-card){transform:translateY(-4px);background:rgba(255,255,255,.05);}
        .ep-card.ep-sel{transform:translateY(-4px);}
        .ep-dim{opacity:.45;cursor:default;}
        .ep-locked-card{opacity:.35;cursor:not-allowed;}
        .ep-acc{height:3px;border-radius:2px;margin-bottom:22px;}
        .ep-ctag{position:absolute;top:16px;right:16px;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:4px 10px;border-radius:100px;}
        .ep-cicon{font-size:30px;margin-bottom:12px;}
        .ep-cname{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:.04em;margin-bottom:4px;}
        .ep-cprice{font-family:'Bebas Neue',sans-serif;font-size:44px;letter-spacing:.03em;line-height:1;margin-bottom:2px;}
        .ep-cpsub{font-size:12px;color:#475569;margin-bottom:22px;}
        .ep-feats{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:24px;}
        .ep-feat{display:flex;align-items:center;gap:9px;font-size:13px;color:#64748b;}
        .ep-tick{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;}
        .ep-cbtn{width:100%;padding:13px;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;border:none;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;}
        .ep-spin{width:13px;height:13px;border:2px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:epSpin .7s linear infinite;}
        .ep-load{display:flex;align-items:center;justify-content:center;padding:60px 0;gap:12px;color:#334155;font-size:14px;}
        .ep-spin-lg{width:22px;height:22px;border:2px solid rgba(249,115,22,.2);border-top-color:#f97316;border-radius:50%;animation:epSpin .7s linear infinite;}

        /* exclusions */
        .ex-box{background:rgba(239,68,68,.04);border:1px solid rgba(239,68,68,.18);border-radius:14px;margin-bottom:32px;overflow:hidden;}
        .ex-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;cursor:pointer;user-select:none;}
        .ex-header-left{display:flex;align-items:center;gap:10px;}
        .ex-icon{font-size:18px;}
        .ex-title{font-size:13px;font-weight:600;color:#f87171;}
        .ex-subtitle{font-size:11px;color:#475569;margin-top:1px;}
        .ex-chevron{font-size:12px;color:#475569;transition:transform .25s;}
        .ex-chevron.open{transform:rotate(180deg);}
        .ex-body{padding:0 20px 20px;display:flex;flex-direction:column;gap:10px;}
        .ex-cat-label{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-top:8px;margin-bottom:4px;}
        .ex-item{border-radius:10px;padding:12px 14px;}
        .ex-item-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}
        .ex-item-title{font-size:13px;font-weight:600;color:#e8eaf0;}
        .ex-item-desc{font-size:12px;color:#64748b;line-height:1.5;margin-bottom:6px;}
        .ex-examples{display:flex;flex-wrap:wrap;gap:5px;}
        .ex-eg{font-size:11px;color:#475569;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:100px;padding:2px 9px;}
        .ex-ack{display:flex;align-items:flex-start;gap:10px;padding:14px 16px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:10px;margin-bottom:28px;cursor:pointer;}
        .ex-ack-box{width:18px;height:18px;border-radius:4px;border:1.5px solid rgba(239,68,68,.4);background:transparent;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;font-size:11px;transition:all .2s;}
        .ex-ack-box.checked{background:#ef4444;border-color:#ef4444;color:#fff;}
        .ex-ack-text{font-size:13px;color:#94a3b8;line-height:1.5;}
        .ex-ack-text strong{color:#f87171;}

        @keyframes epSpin{to{transform:rotate(360deg)}}
        @keyframes epUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes epSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes epPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.4)}}
        @media(max-width:768px){.ep-grid{grid-template-columns:1fr;}.ep-tbl td,.ep-tbl th{padding:9px 10px;font-size:12px;}.ep-active-stats{grid-template-columns:1fr 1fr;}}
      `}</style>

      <div className="ep-root">
        <Navbar />
        <div className="ep-inner">

          {/* Flow */}
          <div className="ep-flow">
            {[{n:"✓",l:"Login",s:"done"},{n:"2",l:"Enroll Policy",s:"active"},
              {n:"3",l:"Pay Premium",s:""},{n:"4",l:"Policies",s:""},
              {n:"5",l:"Earnings",s:""},{n:"6",l:"Delivery",s:""},{n:"7",l:"Risk Map",s:""}
            ].map((st,i,arr)=>(
              <div key={st.l} style={{display:"flex",alignItems:"center"}}>
                <div className={`ep-fs${st.s?" "+st.s:""}`}>
                  <div className="ep-fn">{st.n}</div>{st.l}
                </div>
                {i<arr.length-1 && <div className="ep-fa"/>}
              </div>
            ))}
          </div>

          <p className="ep-eyebrow">Step 2 of 7 — Weekly Coverage</p>
          <h1 className="ep-title">Food Delivery<br /><span>Insurance</span></h1>
          <p className="ep-sub">
            One plan per week — matching the Zomato/Swiggy payout cycle.
            Your coverage activates instantly on enrollment.
          </p>

          {/* ── ACTIVE INSURANCE CARD ── */}
          {active && policies.length > 0 && (
            <div className="ep-active-card">
              <div className="ep-active-header">
                <span className="ep-active-dot"/>
                <span className="ep-active-title">
                  {platformEmoji[platform] || "🛵"}&nbsp;
                  {getPolicyName(active.policy_id)} — ACTIVE
                </span>
                <span className="ep-active-sub">
                  Since {fmtDate(active.enrolled_at)}
                  {active.home_zone && ` · ${active.home_zone.replace("_"," ")}`}
                </span>
              </div>

              <div className="ep-active-stats">
                <div className="ep-as">
                  <div className="ep-as-val">{active.claims_this_week||0}</div>
                  <div className="ep-as-key">Claims this week</div>
                </div>
                <div className="ep-as">
                  <div className="ep-as-val">₹{(active.payout_total_this_week||0).toFixed(0)}</div>
                  <div className="ep-as-key">Paid this week</div>
                </div>
                <div className="ep-as">
                  <div className="ep-as-val">{(active.coverage_hours_used_this_week||0).toFixed(1)}h</div>
                  <div className="ep-as-key">Coverage used</div>
                </div>
                <div className="ep-as">
                  <div className="ep-as-val">₹{(active.total_payout_received||0).toFixed(0)}</div>
                  <div className="ep-as-key">Lifetime payout</div>
                </div>
              </div>

              <div className="ep-active-footer">
                <div className="ep-coverage-status">
                  ✓ Income protection active — disruptions trigger automatic payouts
                </div>
                <button className="ep-continue-btn" onClick={()=>router.push("/pay-premium")}>
                  Pay Premium →
                </button>
              </div>
            </div>
          )}

          {/* ── WEEKLY LOCK BANNER ── */}
          {lockedThisWeek && (
            <div className="ep-lock">
              <span className="ep-lock-icon">🔒</span>
              <div>
                <strong style={{color:"#fbbf24"}}>One plan per week.</strong>
                <span style={{color:"#64748b",marginLeft:6}}>
                  You're covered for this week. You can enroll in a new plan when this week ends.
                </span>
              </div>
              <span className="ep-lock-time">Resets in {weekEnd}</span>
            </div>
          )}

          {/* ── ENROLLMENT HISTORY ── */}
          <p className="ep-sec">Your enrollment history</p>

          {histLoading ? (
            <div className="ep-load" style={{padding:"16px 0",marginBottom:32}}>
              <span className="ep-spin-lg"/>Loading history…
            </div>
          ) : enrollments.length === 0 ? (
            <div className="ep-tbl-wrap" style={{marginBottom:48}}>
              <div className="ep-empty">No enrollments yet — choose a plan below.</div>
            </div>
          ) : (
            <div className="ep-tbl-wrap">
              <table className="ep-tbl">
                <thead>
                  <tr>
                    <th>Plan</th><th>Enrolled on</th><th>Premium</th>
                    <th>Coverage used</th><th>Claims (week / total)</th>
                    <th>Total payout</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map(e => {
                    const tier    = getTier(getPolicyName(e.policy_id))
                    const meta    = TIER_META[tier]
                    const maxHrs  = MAX_HRS[tier]
                    const usedPct = Math.min(100, ((e.coverage_hours_used_this_week||0)/maxHrs)*100)
                    const sc      = statusStyle(e.status)
                    return (
                      <tr key={e.id}>
                        <td>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:16}}>{meta.icon}</span>
                            <span style={{color:meta.color,fontWeight:500}}>
                              {getPolicyName(e.policy_id)}
                            </span>
                          </div>
                        </td>
                        <td>{fmtDate(e.enrolled_at)}</td>
                        <td style={{color:"#e8eaf0",fontWeight:500}}>₹{e.weekly_premium_paid||"—"}</td>
                        <td>
                          <div style={{display:"flex",alignItems:"center"}}>
                            <div className="ep-bar">
                              <div className="ep-bar-fill" style={{width:`${usedPct}%`,background:meta.color}}/>
                            </div>
                            <span style={{fontSize:11,color:"#475569"}}>
                              {(e.coverage_hours_used_this_week||0).toFixed(1)}h/{maxHrs}h
                            </span>
                          </div>
                        </td>
                        <td style={{color:"#e8eaf0"}}>{e.claims_this_week||0} / {e.total_claims||0}</td>
                        <td style={{color:"#4ade80",fontWeight:500}}>₹{(e.total_payout_received||0).toFixed(0)}</td>
                        <td>
                          <span className="ep-pill"
                            style={{background:sc.bg,border:`1px solid ${sc.bd}`,color:sc.tx}}>
                            {e.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── PLAN CARDS ── */}
          <p className="ep-sec">
            {lockedThisWeek ? "Available next week" : "Choose your plan"}
          </p>

          {loading ? (
            <div className="ep-load"><span className="ep-spin-lg"/>Loading plans…</div>
          ) : (
            <>
              <div className="ep-grid">
                {policies.map(p => {
                  const tier  = getTier(p.policy_name)
                  const meta  = TIER_META[tier]
                  const isSel = selected === p.id
                  const isAct = active?.policy_id === p.id

                  // Card is locked if enrolled this week (regardless of which plan)
                  const isLocked = lockedThisWeek && !isAct

                  return (
                    <div key={p.id}
                      className={`ep-card${isSel?" ep-sel":""}${isAct?" ep-dim":""}${isLocked?" ep-locked-card":""}`}
                      onClick={()=>{ if (!isAct && !isLocked) setSelected(p.id) }}
                      style={{
                        borderColor: isAct ? "#22c55e" : isSel ? meta.color : undefined,
                        boxShadow:   isSel && !isLocked ? `0 8px 32px ${meta.glow}` : undefined,
                        background:  isAct ? "rgba(34,197,94,.06)"
                          : isSel ? `${meta.color}0d` : undefined,
                      }}>

                      {isAct && (
                        <div style={{position:"absolute",top:12,left:12,
                          background:"rgba(34,197,94,.15)",border:"1px solid rgba(34,197,94,.3)",
                          borderRadius:100,padding:"3px 10px",fontSize:10,fontWeight:700,
                          color:"#4ade80",letterSpacing:".1em",textTransform:"uppercase"}}>
                          ✓ Active this week
                        </div>
                      )}

                      {isLocked && !isAct && (
                        <div style={{position:"absolute",top:12,left:12,
                          background:"rgba(251,191,36,.1)",border:"1px solid rgba(251,191,36,.2)",
                          borderRadius:100,padding:"3px 10px",fontSize:10,fontWeight:700,
                          color:"#fbbf24",letterSpacing:".1em",textTransform:"uppercase"}}>
                          🔒 Next week
                        </div>
                      )}

                      <div className="ep-ctag"
                        style={{background:`${meta.color}20`,color:meta.color,border:`1px solid ${meta.color}40`}}>
                        {meta.tag}
                      </div>

                      <div className="ep-acc" style={{background:meta.color}}/>
                      <div className="ep-cicon">{meta.icon}</div>
                      <div className="ep-cname" style={{color:isAct?"#4ade80":isSel?meta.color:"#e8eaf0"}}>
                        {p.policy_name}
                      </div>
                      <div className="ep-cprice" style={{color:isAct?"#4ade80":meta.color}}>
                        ₹{p.weekly_premium}
                      </div>
                      <div className="ep-cpsub">
                        per week &nbsp;·&nbsp; ₹{(p.coverage_amount||0).toLocaleString()} coverage
                      </div>

                      <ul className="ep-feats">
                        {meta.features.map(f=>(
                          <li key={f} className="ep-feat">
                            <span className="ep-tick" style={{background:`${meta.color}20`,color:meta.color}}>✓</span>
                            {f}
                          </li>
                        ))}
                      </ul>

                      <button className="ep-cbtn"
                        disabled={isAct || isLocked || enrolling || (!acknowledged && !isAct && !isLocked)}
                        onClick={e=>{e.stopPropagation(); if(!isLocked) enroll(p.id)}}
                        style={{
                          background:
                            isAct    ? "rgba(34,197,94,.12)"
                            : isLocked ? "rgba(255,255,255,.03)"
                            : !acknowledged ? "rgba(255,255,255,.03)"
                            : isSel  ? `linear-gradient(135deg,${meta.color},${meta.color}cc)`
                            : "rgba(255,255,255,.05)",
                          color:
                            isAct    ? "#4ade80"
                            : isLocked ? "#334155"
                            : !acknowledged ? "#334155"
                            : isSel  ? "#fff" : "#64748b",
                          border: `1px solid ${
                            isAct ? "rgba(34,197,94,.3)"
                            : isSel && acknowledged && !isLocked ? meta.color
                            : "rgba(255,255,255,.08)"}`,
                          cursor: isAct||isLocked ? "default" : "pointer",
                          opacity: isLocked && !isAct ? 0.4 : !acknowledged && !isAct && !isLocked ? 0.5 : 1,
                        }}>
                        {isAct     ? "✓ Active this week"
                        : isLocked  ? "🔒 Available next week"
                        : !acknowledged ? "✕ Acknowledge exclusions first"
                        : enrolling && selected===p.id
                          ? <><span className="ep-spin"/>Enrolling…</>
                          : "Enroll & Activate →"}
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Exclusions section */}
              {!lockedThisWeek && exclusions.length > 0 && (
                <div style={{marginTop:40,marginBottom:8}}>
                  <p className="ep-sec">Policy exclusions</p>
                  <div className="ex-box">
                    <div className="ex-header" onClick={()=>setExOpen(o=>!o)}>
                      <div className="ex-header-left">
                        <span className="ex-icon">⚠️</span>
                        <div>
                          <div className="ex-title">What This Policy Does NOT Cover</div>
                          <div className="ex-subtitle">{exclusions.length} exclusions · Read before enrolling</div>
                        </div>
                      </div>
                      <span className={`ex-chevron${exOpen?" open":""}`}>▼</span>
                    </div>

                    {exOpen && (
                      <div className="ex-body">
                        {(["mandatory","regulatory","operational"] as const).map(cat => {
                          const items = exclusions.filter(e => e.category === cat)
                          if (!items.length) return null
                          const cm = CAT_META[cat]
                          return (
                            <div key={cat}>
                              <div className="ex-cat-label" style={{color:cm.color}}>
                                {cm.label} Exclusions
                              </div>
                              {items.map(ex => (
                                <div key={ex.code} className="ex-item"
                                  style={{background:cm.bg,border:`1px solid ${cm.border}`}}>
                                  <div className="ex-item-top">
                                    <span className="ex-item-title">{ex.title}</span>
                                    <span style={{fontSize:10,color:cm.color,fontWeight:700,
                                      textTransform:"uppercase",letterSpacing:".08em"}}>
                                      {ex.code}
                                    </span>
                                  </div>
                                  <p className="ex-item-desc">{ex.description}</p>
                                  <div className="ex-examples">
                                    {ex.examples.map(eg=>(
                                      <span key={eg} className="ex-eg">✗ {eg}</span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="ex-ack" onClick={()=>setAcknowledged(a=>!a)}>
                    <div className={`ex-ack-box${acknowledged?" checked":""}`}>
                      {acknowledged && "✓"}
                    </div>
                    <p className="ex-ack-text">
                      I have read and understood the exclusion clauses. I confirm that
                      GigShield covers <strong>income loss from external disruptions only</strong> and
                      does <strong>not</strong> cover health, life, accidents, vehicle repairs,
                      war, or pandemic events.
                    </p>
                  </div>
                </div>
              )}

              {active && (
                <div style={{textAlign:"center",marginTop:24}}>
                  <button onClick={()=>router.push("/pay-premium")} style={{
                    background:"linear-gradient(135deg,#f97316,#ea580c)",
                    color:"#fff",border:"none",borderRadius:10,
                    padding:"14px 36px",fontFamily:"'DM Sans',sans-serif",
                    fontSize:15,fontWeight:600,cursor:"pointer",
                    boxShadow:"0 4px 20px rgba(249,115,22,.32)",transition:"all .2s",
                  }}>
                    Continue to Pay Premium →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Success toast */}
      {justEnrolled && (
        <div className="ep-success">
          ✓ Insurance activated! Redirecting to payment…
        </div>
      )}
    </>
  )
}