"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import API from "@/services/api"

function tierColor(name: string) {
  const n = (name || "").toLowerCase()
  if (n.includes("premium")) return { color: "#a78bfa", glow: "rgba(167,139,250,.25)" }
  if (n.includes("basic"))   return { color: "#64748b", glow: "rgba(100,116,139,.2)"  }
  return                            { color: "#f97316", glow: "rgba(249,115,22,.25)"  }
}

export default function Policies() {
  const router = useRouter()
  const [policies,  setPolicies]  = useState<any[]>([])
  const [search,    setSearch]    = useState("")
  const [loading,   setLoading]   = useState(true)
  const [enrolling, setEnrolling] = useState<string | null>(null)

  useEffect(() => { fetchPolicies() }, [])

  const fetchPolicies = async () => {
    setLoading(true)
    try { const res = await API.get("/policy/all"); setPolicies(res.data) }
    catch { /* silent */ } finally { setLoading(false) }
  }

  const searchPolicy = async () => {
    if (!search.trim()) { fetchPolicies(); return }
    setLoading(true)
    try { const res = await API.get(`/policy/search?name=${search}`); setPolicies(res.data) }
    catch { setPolicies([]) } finally { setLoading(false) }
  }

  const enroll = async (policyName: string) => {
    const token = localStorage.getItem("user_token")
    setEnrolling(policyName)
    try {
      await API.post("/enrollment/enroll", { policy_name: policyName }, { headers: { Authorization: `Bearer ${token}` } })
      router.push("/pay-premium")
    } catch { alert("You already have a policy this week") }
    finally { setEnrolling(null) }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

        .po-root {
          min-height: 100vh;
          background-color: #0a0c10;
          background-image: radial-gradient(ellipse 80% 40% at 50% -5%, rgba(251,146,60,.08) 0%, transparent 70%),
            linear-gradient(180deg,#0a0c10 0%,#0f1318 100%);
          color: #e8eaf0; font-family: 'DM Sans',sans-serif;
        }

        .po-inner { max-width: 1060px; margin: 0 auto; padding: 52px 24px 80px; }

        .po-flow { display: flex; align-items: center; gap: 0; margin-bottom: 48px; overflow-x: auto; }
        .po-flow-step { display: flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #334155; white-space: nowrap; }
        .po-flow-step.done { color: #22c55e; } .po-flow-step.active { color: #fb923c; }
        .po-flow-num { width: 20px; height: 20px; border-radius: 50%; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; }
        .po-flow-step.done .po-flow-num { background: #22c55e; border-color: #22c55e; color: #0a0c10; }
        .po-flow-step.active .po-flow-num { background: #f97316; border-color: #f97316; color: #fff; }
        .po-flow-arrow { width: 24px; height: 1px; background: rgba(255,255,255,.1); margin: 0 7px; flex-shrink: 0; }

        .po-top { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 36px; gap: 20px; flex-wrap: wrap; }
        .po-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: #475569; margin-bottom: 8px; }
        .po-title { font-family: 'Bebas Neue',sans-serif; font-size: clamp(42px,6vw,68px); letter-spacing: .04em; line-height: .95; }
        .po-title span { background: linear-gradient(135deg,#fb923c,#fbbf24); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

        .po-search-wrap { display: flex; gap: 8px; }
        .po-search { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); border-radius: 10px; padding: 11px 16px; color: #e8eaf0; font-size: 14px; font-family: 'DM Sans',sans-serif; outline: none; width: 220px; transition: border .2s; }
        .po-search:focus { border-color: rgba(249,115,22,.5); }
        .po-search::placeholder { color: #334155; }
        .po-sbtn { padding: 11px 20px; border-radius: 10px; background: rgba(249,115,22,.12); border: 1px solid rgba(249,115,22,.25); color: #fb923c; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'DM Sans',sans-serif; transition: all .2s; }
        .po-sbtn:hover { background: rgba(249,115,22,.22); }

        .po-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }

        .po-card {
          position: relative;
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 16px; padding: 24px;
          transition: all .25s; overflow: hidden;
          animation: poFadeUp .5s ease both;
        }
        .po-card:nth-child(1){animation-delay:.05s}.po-card:nth-child(2){animation-delay:.1s}.po-card:nth-child(3){animation-delay:.15s}
        .po-card:nth-child(4){animation-delay:.2s}.po-card:nth-child(5){animation-delay:.25s}.po-card:nth-child(6){animation-delay:.3s}
        .po-card:hover { border-color: rgba(255,255,255,.15); transform: translateY(-3px); background: rgba(255,255,255,.05); }

        .po-card-bar { height: 2px; border-radius: 1px; margin-bottom: 18px; }
        .po-card-name { font-family: 'Bebas Neue',sans-serif; font-size: 22px; letter-spacing: .04em; margin-bottom: 14px; }

        .po-row { display: flex; justify-content: space-between; font-size: 13px; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
        .po-row:last-of-type { border-bottom: none; }
        .po-row-key { color: #475569; }
        .po-row-val { color: #94a3b8; font-weight: 500; }

        .po-enroll-btn { margin-top: 18px; width: 100%; padding: 12px; border-radius: 9px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); color: #64748b; font-family: 'DM Sans',sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .po-enroll-btn:hover { background: rgba(249,115,22,.1); border-color: rgba(249,115,22,.3); color: #fb923c; }

        .po-spin { width: 12px; height: 12px; border: 2px solid rgba(255,255,255,.2); border-top-color: #fff; border-radius: 50%; animation: poSpin .7s linear infinite; }
        @keyframes poSpin { to { transform: rotate(360deg); } }

        /* bottom CTA */
        .po-next-bar { margin-top: 40px; display: flex; justify-content: flex-end; }
        .po-next-btn { padding: 14px 36px; border-radius: 10px; background: linear-gradient(135deg,#f97316,#ea580c); color: #fff; font-family: 'DM Sans',sans-serif; font-size: 15px; font-weight: 600; border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(249,115,22,.28); transition: all .2s; }
        .po-next-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(249,115,22,.4); }

        .po-loading { display: flex; align-items: center; justify-content: center; padding: 80px 0; gap: 12px; color: #334155; font-size: 14px; }
        .po-spin-lg { width: 22px; height: 22px; border: 2px solid rgba(249,115,22,.2); border-top-color: #f97316; border-radius: 50%; animation: poSpin .7s linear infinite; }
        .po-empty { text-align: center; padding: 60px 0; color: #334155; font-size: 14px; }

        @keyframes poFadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @media(max-width:768px){ .po-grid{grid-template-columns:1fr;} }
      `}</style>

      <div className="po-root">
        <Navbar />
        <div className="po-inner">

          <div className="po-flow">
            {[
              { n: "✓", l: "Login",         s: "done"   },
              { n: "✓", l: "Enroll",        s: "done"   },
              { n: "✓", l: "Pay Premium",   s: "done"   },
              { n: "4", l: "Policies",      s: "active" },
              { n: "5", l: "Earnings",      s: ""       },
              { n: "6", l: "Delivery",      s: ""       },
              { n: "7", l: "Risk Map",      s: ""       },
            ].map((step, i, arr) => (
              <div key={step.l} style={{ display: "flex", alignItems: "center" }}>
                <div className={`po-flow-step${step.s ? ` ${step.s}` : ""}`}>
                  <div className="po-flow-num">{step.n}</div>
                  {step.l}
                </div>
                {i < arr.length - 1 && <div className="po-flow-arrow" />}
              </div>
            ))}
          </div>

          <div className="po-top">
            <div>
              <p className="po-eyebrow">Step 4 of 7 — View Plans</p>
              <h1 className="po-title">Insurance<br /><span>Policies</span></h1>
            </div>
            <div className="po-search-wrap">
              <input className="po-search" placeholder="Search plan name…"
                value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchPolicy()} />
              <button className="po-sbtn" onClick={searchPolicy}>Search</button>
            </div>
          </div>

          {loading ? (
            <div className="po-loading"><span className="po-spin-lg" />Loading plans…</div>
          ) : policies.length === 0 ? (
            <div className="po-empty">No policies found.</div>
          ) : (
            <>
              <div className="po-grid">
                {policies.map((p) => {
                  const { color, glow } = tierColor(p.policy_name)
                  return (
                    <div key={p.id} className="po-card"
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = color; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 28px ${glow}` }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = ""; (e.currentTarget as HTMLElement).style.boxShadow = "" }}>
                      <div className="po-card-bar" style={{ background: color }} />
                      <div className="po-card-name" style={{ color }}>{p.policy_name}</div>
                      <div className="po-row"><span className="po-row-key">Coverage</span><span className="po-row-val">₹{(p.coverage_amount || 0).toLocaleString()}</span></div>
                      <div className="po-row"><span className="po-row-key">Weekly premium</span><span className="po-row-val" style={{ color }}>₹{p.weekly_premium}</span></div>
                      {p.description && (
                        <div className="po-row"><span className="po-row-key">Details</span><span className="po-row-val" style={{ maxWidth: 160, textAlign: "right", lineHeight: 1.4 }}>{p.description}</span></div>
                      )}
                      <button className="po-enroll-btn"
                        onClick={() => enroll(p.policy_name)}
                        disabled={enrolling === p.policy_name}>
                        {enrolling === p.policy_name
                          ? <><span className="po-spin" />Enrolling…</>
                          : "Enroll in this plan →"}
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Next step */}
              <div className="po-next-bar">
                <button className="po-next-btn" onClick={() => router.push("/earnings")}>
                  Continue to Earnings Dashboard →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}