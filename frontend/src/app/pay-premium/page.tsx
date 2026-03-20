"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"
import API from "@/services/api"

const METHODS = [
  { id: "UPI",  icon: "📱", label: "UPI",   sub: "Instant · PhonePe / GPay / Paytm" },
  { id: "IMPS", icon: "🏦", label: "IMPS",  sub: "Bank transfer · ~2 minutes" },
  { id: "NEFT", icon: "💳", label: "NEFT",  sub: "Net banking · ~30 minutes" },
]

export default function PayPremium() {
  const router = useRouter()
  const [policyId, setPolicyId] = useState("")
  const [amount,   setAmount]   = useState("")
  const [method,   setMethod]   = useState("UPI")
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)
  const [txId,     setTxId]     = useState("")

  const payPremium = async () => {
    if (!policyId || !amount) { alert("Please fill all fields"); return }
    const token = localStorage.getItem("user_token")
    setLoading(true)
    try {
      await API.post(
        "/premium/pay",
        { policy_id: Number(policyId), amount: Number(amount) },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setTxId(`TXN-${Date.now().toString().slice(-8)}`)
      setSuccess(true)
      setTimeout(() => router.push("/policies"), 2800)
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Payment failed. Try again.")
    } finally { setLoading(false) }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

        .pp-root {
          min-height: 100vh;
          background-color: #0a0c10;
          background-image:
            radial-gradient(ellipse 70% 40% at 50% -5%, rgba(167,139,250,.08) 0%, transparent 70%),
            linear-gradient(180deg, #0a0c10 0%, #0f1318 100%);
          color: #e8eaf0;
          font-family: 'DM Sans', sans-serif;
        }

        .pp-inner { max-width: 560px; margin: 0 auto; padding: 52px 24px 80px; }

        /* FLOW */
        .pp-flow { display: flex; align-items: center; gap: 0; margin-bottom: 48px; overflow-x: auto; }
        .pp-flow-step { display: flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #334155; white-space: nowrap; }
        .pp-flow-step.done  { color: #22c55e; }
        .pp-flow-step.active { color: #fb923c; }
        .pp-flow-num { width: 20px; height: 20px; border-radius: 50%; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; }
        .pp-flow-step.done .pp-flow-num  { background: #22c55e; border-color: #22c55e; color: #0a0c10; }
        .pp-flow-step.active .pp-flow-num { background: #f97316; border-color: #f97316; color: #fff; }
        .pp-flow-arrow { width: 24px; height: 1px; background: rgba(255,255,255,.1); margin: 0 7px; flex-shrink: 0; }

        /* HEADER */
        .pp-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: #475569; margin-bottom: 10px; }
        .pp-title { font-family: 'Bebas Neue', sans-serif; font-size: clamp(44px,7vw,72px); letter-spacing: .04em; line-height: .95; margin-bottom: 10px; }
        .pp-title span { background: linear-gradient(135deg,#a78bfa,#818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .pp-sub { font-size: 14px; color: #475569; margin-bottom: 36px; }

        /* CARD */
        .pp-card { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); border-radius: 18px; padding: 32px; animation: ppFadeUp .5s ease both; }
        @keyframes ppFadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }

        /* LABEL / INPUT */
        .pp-label { display: block; font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: #475569; margin-bottom: 8px; }
        .pp-input { width: 100%; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); border-radius: 10px; padding: 13px 16px; color: #e8eaf0; font-size: 15px; font-family: 'DM Sans',sans-serif; outline: none; transition: border .2s, box-shadow .2s; margin-bottom: 20px; }
        .pp-input:focus { border-color: rgba(249,115,22,.5); box-shadow: 0 0 0 3px rgba(249,115,22,.08); }
        .pp-input::placeholder { color: #334155; }

        /* PREVIEW */
        .pp-preview { background: rgba(255,255,255,.025); border: 1px solid rgba(255,255,255,.07); border-radius: 12px; padding: 16px 18px; margin-bottom: 22px; display: flex; flex-direction: column; gap: 8px; }
        .pp-prev-row { display: flex; justify-content: space-between; font-size: 13px; }
        .pp-prev-key { color: #475569; }
        .pp-prev-val { color: #94a3b8; font-weight: 500; }
        .pp-prev-total { border-top: 1px solid rgba(255,255,255,.07); padding-top: 10px; margin-top: 2px; }
        .pp-prev-total .pp-prev-key { color: #e8eaf0; font-weight: 600; font-size: 14px; }
        .pp-prev-total .pp-prev-val { color: #f97316; font-weight: 700; font-size: 18px; font-family: 'Bebas Neue',sans-serif; letter-spacing: .04em; }

        /* METHODS */
        .pp-methods { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 22px; }
        .pp-method { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 14px 10px; cursor: pointer; transition: all .2s; text-align: center; }
        .pp-method:hover { border-color: rgba(255,255,255,.18); }
        .pp-method.active { border-color: #f97316; background: rgba(249,115,22,.08); box-shadow: 0 0 0 1px rgba(249,115,22,.2); }
        .pp-method-icon { font-size: 22px; margin-bottom: 6px; }
        .pp-method-label { font-size: 13px; font-weight: 600; color: #e8eaf0; margin-bottom: 3px; }
        .pp-method-sub { font-size: 10px; color: #475569; line-height: 1.4; }

        /* BUTTON */
        .pp-btn { width: 100%; padding: 15px; border-radius: 10px; background: linear-gradient(135deg,#f97316,#ea580c); color: #fff; font-family: 'DM Sans',sans-serif; font-size: 15px; font-weight: 600; border: none; cursor: pointer; transition: all .2s; box-shadow: 0 4px 20px rgba(249,115,22,.28); display: flex; align-items: center; justify-content: center; gap: 10px; }
        .pp-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(249,115,22,.4); }
        .pp-btn:disabled { opacity: .5; cursor: not-allowed; }
        .pp-spin { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: ppSpin .7s linear infinite; }
        @keyframes ppSpin { to { transform: rotate(360deg); } }

        /* SUCCESS */
        .pp-success { animation: ppFadeUp .4s ease both; }
        .pp-success-card { background: rgba(34,197,94,.06); border: 1px solid rgba(34,197,94,.2); border-radius: 18px; padding: 48px 32px; text-align: center; }
        .pp-success-icon { font-size: 56px; margin-bottom: 18px; }
        .pp-success-title { font-family: 'Bebas Neue',sans-serif; font-size: 40px; letter-spacing: .04em; color: #4ade80; margin-bottom: 8px; }
        .pp-success-sub { font-size: 14px; color: #475569; margin-bottom: 16px; }
        .pp-success-txn { display: inline-block; background: rgba(34,197,94,.1); border: 1px solid rgba(34,197,94,.2); border-radius: 8px; padding: 6px 14px; font-size: 12px; font-weight: 600; color: #4ade80; letter-spacing: .08em; }
        .pp-success-redirect { margin-top: 20px; font-size: 12px; color: #334155; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .pp-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; animation: ppPulse 1.2s ease-in-out infinite; }
        @keyframes ppPulse { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>

      <div className="pp-root">
        <Navbar />
        <div className="pp-inner">

          {/* Flow */}
          <div className="pp-flow">
            {[
              { n: "✓", l: "Login",         s: "done"   },
              { n: "✓", l: "Enroll Policy", s: "done"   },
              { n: "3", l: "Pay Premium",   s: "active" },
              { n: "4", l: "Policies",      s: ""       },
              { n: "5", l: "Earnings",      s: ""       },
              { n: "6", l: "Delivery",      s: ""       },
              { n: "7", l: "Risk Map",      s: ""       },
            ].map((step, i, arr) => (
              <div key={step.l} style={{ display: "flex", alignItems: "center" }}>
                <div className={`pp-flow-step${step.s ? ` ${step.s}` : ""}`}>
                  <div className="pp-flow-num">{step.n}</div>
                  {step.l}
                </div>
                {i < arr.length - 1 && <div className="pp-flow-arrow" />}
              </div>
            ))}
          </div>

          <p className="pp-eyebrow">Step 3 of 7 — Activate Coverage</p>
          <h1 className="pp-title">Pay<br /><span>Premium</span></h1>
          <p className="pp-sub">Weekly payment. Secure. Instant UPI confirmation.</p>

          {success ? (
            <div className="pp-success">
              <div className="pp-success-card">
                <div className="pp-success-icon">✅</div>
                <div className="pp-success-title">Payment Successful</div>
                <div className="pp-success-sub">Your coverage is now active for this week.</div>
                <div className="pp-success-txn">{txId}</div>
                <div className="pp-success-redirect">
                  <span className="pp-dot" />
                  Redirecting to Policies…
                </div>
              </div>
            </div>
          ) : (
            <div className="pp-card">

              <label className="pp-label">Policy ID</label>
              <input className="pp-input" type="number" placeholder="e.g. 1"
                value={policyId} onChange={(e) => setPolicyId(e.target.value)} />

              <label className="pp-label">Premium Amount (₹)</label>
              <input className="pp-input" type="number" placeholder="e.g. 99"
                value={amount} onChange={(e) => setAmount(e.target.value)} />

              {/* Preview */}
              {amount && (
                <div className="pp-preview">
                  <div className="pp-prev-row">
                    <span className="pp-prev-key">Coverage period</span>
                    <span className="pp-prev-val">7 days (current week)</span>
                  </div>
                  <div className="pp-prev-row">
                    <span className="pp-prev-key">Payment method</span>
                    <span className="pp-prev-val">{method}</span>
                  </div>
                  <div className="pp-prev-row pp-prev-total">
                    <span className="pp-prev-key">Total</span>
                    <span className="pp-prev-val">₹{amount}</span>
                  </div>
                </div>
              )}

              <label className="pp-label">Payment Method</label>
              <div className="pp-methods">
                {METHODS.map((m) => (
                  <div key={m.id}
                    className={`pp-method${method === m.id ? " active" : ""}`}
                    onClick={() => setMethod(m.id)}>
                    <div className="pp-method-icon">{m.icon}</div>
                    <div className="pp-method-label">{m.label}</div>
                    <div className="pp-method-sub">{m.sub}</div>
                  </div>
                ))}
              </div>

              <button className="pp-btn" onClick={payPremium} disabled={loading}>
                {loading
                  ? <><span className="pp-spin" />Processing…</>
                  : <>Pay ₹{amount || "—"} via {method} →</>}
              </button>

            </div>
          )}
        </div>
      </div>
    </>
  )
}