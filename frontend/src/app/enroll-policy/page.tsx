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

const TIER_META: Record<string, { color: string; glow: string; icon: string; tag: string; features: string[] }> = {
  basic:    { color:"#64748b", glow:"rgba(100,116,139,.25)", icon:"🌱", tag:"Starter",
              features:["₹500 max weekly payout","8 hrs/week coverage","2 claims per week","Rain + Heat triggers"] },
  standard: { color:"#f97316", glow:"rgba(249,115,22,.28)",  icon:"⚡", tag:"Popular",
              features:["₹1,200 max weekly payout","16 hrs/week coverage","3 claims per week","All disruption types","AQI + Curfew triggers"] },
  premium:  { color:"#a78bfa", glow:"rgba(167,139,250,.28)", icon:"💎", tag:"Best Value",
              features:["₹2,500 max weekly payout","30 hrs/week coverage","5 claims per week","All disruption types","Flood zone bonus hours","Instant UPI payout"] },
}

const MAX_HRS: Record<string, number> = { basic:8, standard:16, premium:30 }

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

export default function EnrollPolicy() {
  const router = useRouter()
  const [policies,    setPolicies]    = useState<Policy[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [active,      setActive]      = useState<Enrollment|null>(null)
  const [selected,    setSelected]    = useState<number|null>(null)
  const [loading,     setLoading]     = useState(true)
  const [histLoading, setHistLoading] = useState(true)
  const [enrolling,   setEnrolling]   = useState(false)

  useEffect(() => { fetchPolicies(); fetchHistory() }, [])

  const fetchPolicies = async () => {
    try { const r = await API.get("/policy/all"); setPolicies(r.data) }
    catch { } finally { setLoading(false) }
  }

  const fetchHistory = async () => {
    const token = localStorage.getItem("user_token")
    setHistLoading(true)
    try {
      // Try full history first
      const r = await API.get("/enrollment/history", { headers:{ Authorization:`Bearer ${token}` } })
      const arr: Enrollment[] = Array.isArray(r.data) ? r.data : [r.data]
      setEnrollments(arr)
      setActive(arr.find(e => e.status==="active") || null)
    } catch {
      // Fallback to single endpoint
      try {
        const r = await API.get("/enrollment/my-policy", { headers:{ Authorization:`Bearer ${token}` } })
        if (r.data) { setEnrollments([r.data]); setActive(r.data.status==="active"?r.data:null) }
        else { setEnrollments([]) }
      } catch { setEnrollments([]) }
    } finally { setHistLoading(false) }
  }

  const getPolicyName = (pid: number) =>
    policies.find(p=>p.id===pid)?.policy_name || `Policy #${pid}`

  const enroll = async (policyId: number) => {
    const token = localStorage.getItem("user_token")
    setEnrolling(true)
    try {
      await API.post("/enrollment/enroll", { policy_id: policyId },
        { headers:{ Authorization:`Bearer ${token}` } })
      await fetchHistory()
      router.push("/pay-premium")
    } catch {
      // Don't alert — just refresh to show existing policy in history
      await fetchHistory()
    } finally { setEnrolling(false) }
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

        /* ACTIVE BANNER */
        .ep-banner{background:rgba(249,115,22,.07);border:1px solid rgba(249,115,22,.25);border-radius:14px;padding:20px 24px;margin-bottom:36px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;animation:epUp .4s ease both;}
        .ep-banner-left{display:flex;align-items:center;gap:14px;}
        .ep-banner-icon{width:42px;height:42px;border-radius:10px;background:rgba(249,115,22,.15);border:1px solid rgba(249,115,22,.3);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
        .ep-banner-name{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:.04em;color:#fb923c;}
        .ep-banner-sub{font-size:13px;color:#475569;margin-top:2px;}
        .ep-banner-stats{display:flex;gap:20px;flex-wrap:wrap;}
        .ep-bs{text-align:right;}
        .ep-bs-val{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:.04em;color:#e8eaf0;}
        .ep-bs-key{font-size:10px;color:#475569;text-transform:uppercase;letter-spacing:.08em;}
        .ep-banner-btn{padding:10px 20px;border-radius:9px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(249,115,22,.28);transition:all .2s;white-space:nowrap;}
        .ep-banner-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(249,115,22,.38);}

        /* SECTION */
        .ep-sec{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#475569;margin-bottom:14px;display:flex;align-items:center;gap:10px;}
        .ep-sec::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.06);}

        /* HISTORY TABLE */
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

        /* POLICY CARDS */
        .ep-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:16px;}
        .ep-card{position:relative;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:28px 24px;cursor:pointer;transition:all .25s;overflow:hidden;animation:epUp .5s ease both;}
        .ep-card:nth-child(1){animation-delay:.1s}.ep-card:nth-child(2){animation-delay:.2s}.ep-card:nth-child(3){animation-delay:.3s}
        .ep-card:hover:not(.ep-dim){transform:translateY(-4px);background:rgba(255,255,255,.05);}
        .ep-card.ep-sel{transform:translateY(-4px);}
        .ep-dim{opacity:.45;cursor:default;}
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

        @keyframes epSpin{to{transform:rotate(360deg)}}
        @keyframes epUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:768px){.ep-grid{grid-template-columns:1fr;}.ep-tbl td,.ep-tbl th{padding:9px 10px;font-size:12px;}}
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

          <p className="ep-eyebrow">Step 2 of 7 — Choose Plan</p>
          <h1 className="ep-title">Weekly<br /><span>Coverage</span></h1>
          <p className="ep-sub">Plans priced weekly — matching the gig worker pay cycle. Cancel or switch anytime.</p>

          {/* ── ACTIVE POLICY BANNER ── */}
          {active && policies.length > 0 && (
            <div className="ep-banner">
              <div className="ep-banner-left">
                <div className="ep-banner-icon">
                  {TIER_META[getTier(getPolicyName(active.policy_id))].icon}
                </div>
                <div>
                  <div className="ep-banner-name">{getPolicyName(active.policy_id)}</div>
                  <div className="ep-banner-sub">
                    Active since {fmtDate(active.enrolled_at)}
                    {active.home_zone && <> &nbsp;·&nbsp; {active.home_zone}</>}
                  </div>
                </div>
              </div>
              <div className="ep-banner-stats">
                <div className="ep-bs">
                  <div className="ep-bs-val">{active.claims_this_week||0}</div>
                  <div className="ep-bs-key">Claims this week</div>
                </div>
                <div className="ep-bs">
                  <div className="ep-bs-val">₹{(active.payout_total_this_week||0).toFixed(0)}</div>
                  <div className="ep-bs-key">Paid this week</div>
                </div>
                <div className="ep-bs">
                  <div className="ep-bs-val">₹{(active.total_payout_received||0).toFixed(0)}</div>
                  <div className="ep-bs-key">Lifetime payout</div>
                </div>
              </div>
              <button className="ep-banner-btn" onClick={()=>router.push("/pay-premium")}>
                Pay Premium →
              </button>
            </div>
          )}

          {/* ── ENROLLMENT HISTORY TABLE ── */}
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
                    <th>Plan</th>
                    <th>Enrolled on</th>
                    <th>Premium</th>
                    <th>Coverage used</th>
                    <th>Claims (week / total)</th>
                    <th>Total payout</th>
                    <th>Status</th>
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
                        <td style={{color:"#e8eaf0",fontWeight:500}}>
                          ₹{e.weekly_premium_paid||"—"}
                        </td>
                        <td>
                          <div style={{display:"flex",alignItems:"center"}}>
                            <div className="ep-bar">
                              <div className="ep-bar-fill"
                                style={{width:`${usedPct}%`,background:meta.color}}/>
                            </div>
                            <span style={{fontSize:11,color:"#475569"}}>
                              {(e.coverage_hours_used_this_week||0).toFixed(1)}h/{maxHrs}h
                            </span>
                          </div>
                        </td>
                        <td style={{color:"#e8eaf0"}}>
                          {e.claims_this_week||0} / {e.total_claims||0}
                        </td>
                        <td style={{color:"#4ade80",fontWeight:500}}>
                          ₹{(e.total_payout_received||0).toFixed(0)}
                        </td>
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
          <p className="ep-sec">Available plans</p>

          {loading ? (
            <div className="ep-load"><span className="ep-spin-lg"/>Loading plans…</div>
          ) : (
            <>
              <div className="ep-grid">
                {policies.map(p => {
                  const tier    = getTier(p.policy_name)
                  const meta    = TIER_META[tier]
                  const isSel   = selected === p.id
                  const isAct   = active?.policy_id === p.id

                  return (
                    <div key={p.id}
                      className={`ep-card${isSel?" ep-sel":""}${isAct?" ep-dim":""}`}
                      onClick={()=> !isAct && setSelected(p.id)}
                      style={{
                        borderColor: isSel||isAct ? meta.color : undefined,
                        boxShadow:   isSel ? `0 8px 32px ${meta.glow}` : undefined,
                        background:  isAct ? `${meta.color}08` : isSel ? `${meta.color}0d` : undefined,
                      }}>

                      {isAct && (
                        <div style={{position:"absolute",top:12,left:12,
                          background:"rgba(34,197,94,.15)",border:"1px solid rgba(34,197,94,.3)",
                          borderRadius:100,padding:"3px 10px",fontSize:10,fontWeight:700,
                          color:"#4ade80",letterSpacing:".1em",textTransform:"uppercase"}}>
                          Currently active
                        </div>
                      )}

                      <div className="ep-ctag"
                        style={{background:`${meta.color}20`,color:meta.color,border:`1px solid ${meta.color}40`}}>
                        {meta.tag}
                      </div>

                      <div className="ep-acc" style={{background:meta.color}}/>
                      <div className="ep-cicon">{meta.icon}</div>
                      <div className="ep-cname" style={{color:isSel||isAct?meta.color:"#e8eaf0"}}>
                        {p.policy_name}
                      </div>
                      <div className="ep-cprice" style={{color:meta.color}}>₹{p.weekly_premium}</div>
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
                        disabled={isAct||enrolling}
                        onClick={e=>{e.stopPropagation(); enroll(p.id)}}
                        style={{
                          background: isAct ? "rgba(34,197,94,.1)"
                            : isSel ? `linear-gradient(135deg,${meta.color},${meta.color}cc)`
                            : "rgba(255,255,255,.05)",
                          color:  isAct ? "#4ade80" : isSel ? "#fff" : "#64748b",
                          border: `1px solid ${isAct ? "rgba(34,197,94,.3)" : isSel ? meta.color : "rgba(255,255,255,.08)"}`,
                          boxShadow: isSel ? `0 4px 16px ${meta.glow}` : "none",
                          cursor: isAct ? "default" : "pointer",
                        }}>
                        {isAct ? "✓  Currently active"
                          : enrolling && selected===p.id
                            ? <><span className="ep-spin"/>Enrolling…</>
                            : "Enroll & Continue →"}
                      </button>
                    </div>
                  )
                })}
              </div>

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
    </>
  )
}