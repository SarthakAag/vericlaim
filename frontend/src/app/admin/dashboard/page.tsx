"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import API from "@/services/api"

const TIERS = ["basic", "standard", "premium"]

const defaultForm = {
  policy_name: "",
  policy_tier: "basic",
  description: "",
  weekly_premium: "",
  coverage_amount: "",
  max_weekly_payout: "",
  coverage_hours_per_week: "",
  max_claims_per_week: "",
  min_disruption_hours: "0.5",
  income_covered_pct: "0.70",
  min_weekly_income: "0",
  max_weekly_income: "999999",
  is_active: true,
}

export default function AdminDashboard() {
  const router = useRouter()
  const [form, setForm] = useState({ ...defaultForm })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [policies, setPolicies] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<"create" | "policies">("create")
  const [policiesLoading, setPoliciesLoading] = useState(false)

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem("admin_token")
    if (!token) router.push("/admin/login")
  }, [])

  // Load policies when tab switches
  useEffect(() => {
    if (activeTab === "policies") fetchPolicies()
  }, [activeTab])

  const fetchPolicies = async () => {
    try {
      setPoliciesLoading(true)
      const res = await API.get("/policy/all")
      setPolicies(res.data)
    } catch {
      alert("Failed to load policies")
    } finally {
      setPoliciesLoading(false)
    }
  }

  const set = (key: string, value: any) =>
    setForm((f) => ({ ...f, [key]: value }))

  const addPolicy = async () => {
    const token = localStorage.getItem("admin_token")

    if (!token) {
      router.push("/admin/login")
      return
    }

    if (
      !form.policy_name ||
      !form.policy_tier ||
      !form.weekly_premium ||
      !form.coverage_amount ||
      !form.max_weekly_payout ||
      !form.coverage_hours_per_week ||
      !form.max_claims_per_week
    ) {
      alert("Please fill in all required fields")
      return
    }

    try {
      setLoading(true)
      await API.post(
        "/policy/create",
        {
          policy_name: form.policy_name,
          policy_tier: form.policy_tier,
          description: form.description,
          weekly_premium: Number(form.weekly_premium),
          coverage_amount: Number(form.coverage_amount),
          max_weekly_payout: Number(form.max_weekly_payout),
          coverage_hours_per_week: Number(form.coverage_hours_per_week),
          max_claims_per_week: Number(form.max_claims_per_week),
          min_disruption_hours: Number(form.min_disruption_hours),
          income_covered_pct: Number(form.income_covered_pct),
          min_weekly_income: Number(form.min_weekly_income),
          max_weekly_income: Number(form.max_weekly_income),
          is_active: form.is_active,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSuccess(true)
      setForm({ ...defaultForm })
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      if (err?.response?.status === 401) {
        alert("Session expired. Please login again.")
        localStorage.removeItem("admin_token")
        router.push("/admin/login")
        return
      }
      alert(err?.response?.data?.detail || "Failed to create policy")
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem("admin_token")
    router.push("/admin/login")
  }

  const tierColor: Record<string, string> = {
    basic:    "rgba(59,130,246,0.15)",
    standard: "rgba(249,115,22,0.15)",
    premium:  "rgba(168,85,247,0.15)",
  }
  const tierTextColor: Record<string, string> = {
    basic:    "#60a5fa",
    standard: "#fb923c",
    premium:  "#c084fc",
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }

        .dash-page {
          min-height: 100vh;
          background: #05070a;
          font-family: 'DM Sans', sans-serif;
          color: #e8eaf0;
        }

        .dash-body {
          max-width: 820px;
          margin: 0 auto;
          padding: 48px 24px 80px;
        }

        .dash-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 36px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .dash-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          color: #ef4444;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 5px 12px;
          border-radius: 100px;
          margin-bottom: 16px;
        }

        .badge-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #ef4444;
          animation: pulse 2s ease-in-out infinite;
        }

        .dash-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 48px;
          letter-spacing: 0.04em;
          line-height: 1;
          color: #e8eaf0;
          margin: 0 0 8px;
        }

        .dash-title span {
          background: linear-gradient(135deg, #ef4444, #f97316);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .dash-subtitle { font-size: 14px; color: #475569; }

        .btn-logout {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          border-radius: 10px;
          border: 1px solid rgba(239,68,68,0.2);
          background: rgba(239,68,68,0.08);
          color: #f87171;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
          white-space: nowrap;
        }
        .btn-logout:hover { background: rgba(239,68,68,0.16); border-color: rgba(239,68,68,0.4); }

        .tabs {
          display: flex;
          gap: 4px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 28px;
        }

        .tab-btn {
          flex: 1;
          padding: 10px 16px;
          border: none;
          border-radius: 9px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          background: transparent;
          color: #475569;
          letter-spacing: 0.02em;
        }

        .tab-btn.active {
          background: #0f1318;
          color: #e8eaf0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }

        .dash-card {
          position: relative;
          background: #0f1318;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 36px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.5);
        }

        .dash-card::before {
          content: '';
          position: absolute;
          top: 0; left: 10%; right: 10%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #ef4444, transparent);
          border-radius: 0 0 4px 4px;
        }

        .section-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #334155;
          margin: 28px 0 16px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .section-label:first-child { margin-top: 0; }
        .section-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.06);
        }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }

        .field { display: flex; flex-direction: column; gap: 7px; }
        .field label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: #475569;
        }
        .field-required::after { content: ' *'; color: #ef4444; }

        .field-input,
        .field-textarea {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 10px;
          padding: 11px 14px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #e8eaf0;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          width: 100%;
        }
        .field-input::placeholder,
        .field-textarea::placeholder { color: #2d3a4a; }
        .field-input:focus,
        .field-textarea:focus {
          border-color: rgba(239,68,68,0.45);
          background: rgba(239,68,68,0.03);
          box-shadow: 0 0 0 3px rgba(239,68,68,0.07);
        }
        .field-textarea { resize: vertical; min-height: 80px; }

        .tier-group { display: flex; gap: 10px; }
        .tier-btn {
          flex: 1;
          padding: 10px 8px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.09);
          background: rgba(255,255,255,0.03);
          color: #475569;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: capitalize;
          cursor: pointer;
          transition: all 0.2s;
        }
        .tier-btn:hover { color: #94a3b8; border-color: rgba(255,255,255,0.18); }
        .tier-btn.active-basic    { background: rgba(59,130,246,0.12); border-color: rgba(59,130,246,0.4); color: #60a5fa; }
        .tier-btn.active-standard { background: rgba(249,115,22,0.12); border-color: rgba(249,115,22,0.4); color: #fb923c; }
        .tier-btn.active-premium  { background: rgba(168,85,247,0.12); border-color: rgba(168,85,247,0.4); color: #c084fc; }

        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 12px 16px;
          margin-top: 14px;
        }
        .toggle-label { font-size: 13px; font-weight: 500; color: #94a3b8; }
        .toggle { position: relative; width: 42px; height: 24px; cursor: pointer; }
        .toggle input { display: none; }
        .toggle-track {
          position: absolute; inset: 0;
          border-radius: 100px;
          background: rgba(255,255,255,0.08);
          transition: background 0.2s;
        }
        .toggle input:checked ~ .toggle-track { background: #ef4444; }
        .toggle-thumb {
          position: absolute;
          top: 3px; left: 3px;
          width: 18px; height: 18px;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.2s;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        .toggle input:checked ~ .toggle-thumb { transform: translateX(18px); }

        .btn-submit {
          width: 100%;
          padding: 15px;
          margin-top: 28px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: transform 0.18s, box-shadow 0.18s;
          box-shadow: 0 4px 20px rgba(239,68,68,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .btn-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(239,68,68,0.4); }
        .btn-submit:disabled { opacity: 0.55; cursor: not-allowed; }

        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        /* ── POLICY LIST ── */
        .policy-list { display: flex; flex-direction: column; gap: 12px; }

        .policy-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .policy-card-left { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; }

        .policy-tier-badge {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .policy-name { font-size: 15px; font-weight: 600; color: #e8eaf0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .policy-desc { font-size: 12px; color: #475569; margin-top: 2px; }

        .policy-card-right {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .policy-stat { text-align: right; }
        .policy-stat-val { font-size: 15px; font-weight: 600; color: #e8eaf0; white-space: nowrap; }
        .policy-stat-label { font-size: 11px; color: #334155; text-transform: uppercase; letter-spacing: 0.06em; }

        .active-pill {
          padding: 3px 10px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          white-space: nowrap;
        }
        .active-pill.on  { background: rgba(34,197,94,0.12); color: #4ade80; border: 1px solid rgba(34,197,94,0.25); }
        .active-pill.off { background: rgba(239,68,68,0.1);  color: #f87171; border: 1px solid rgba(239,68,68,0.2); }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #334155;
          font-size: 14px;
        }
        .empty-icon { font-size: 40px; margin-bottom: 12px; }

        .toast {
          position: fixed;
          bottom: 24px; right: 24px; left: 24px;
          max-width: 340px;
          margin: 0 auto;
          background: #0f1318;
          border: 1px solid rgba(34,197,94,0.3);
          border-radius: 12px;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 500;
          color: #4ade80;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          animation: slideUp 0.3s ease;
          z-index: 999;
        }

        @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.8); } }

        /* ── RESPONSIVE ── */

        /* Tablet: 560–768px */
        @media (max-width: 768px) {
          .dash-body { padding: 32px 16px 60px; }
          .dash-title { font-size: 40px; }
          .dash-card  { padding: 28px 20px; }
          .grid-3 { grid-template-columns: 1fr 1fr; }
        }

        /* Mobile: ≤ 560px */
        @media (max-width: 560px) {
          .dash-body  { padding: 24px 14px 60px; }
          .dash-title { font-size: 34px; }
          .dash-card  { padding: 22px 16px; }

          /* All grids → single column */
          .grid-2, .grid-3 { grid-template-columns: 1fr; }

          /* Tier buttons stack if too narrow */
          .tier-group { flex-wrap: wrap; }
          .tier-btn   { min-width: calc(50% - 5px); }

          /* Policy cards: stack vertically */
          .policy-card { flex-direction: column; align-items: flex-start; gap: 12px; }
          .policy-card-right {
            width: 100%;
            justify-content: flex-start;
            gap: 12px;
            padding-top: 10px;
            border-top: 1px solid rgba(255,255,255,0.06);
          }
          .policy-stat { text-align: left; }

          /* Field inputs: prevent iOS zoom */
          .field-input, .field-textarea { font-size: 16px; }

          /* Toast: full-width */
          .toast { left: 14px; right: 14px; max-width: 100%; }
        }

        /* Very small: ≤ 380px */
        @media (max-width: 380px) {
          .dash-title { font-size: 28px; }
          .tab-btn    { font-size: 12px; padding: 9px 10px; }
          .tier-btn   { min-width: 100%; }
        }
      `}</style>

      <div className="dash-page">
        <div className="dash-body">

          {/* Header */}
          <div className="dash-header">
            <div>
              <div className="dash-badge"><span className="badge-dot" />Admin Dashboard</div>
              <h1 className="dash-title">Policy<br /><span>Management</span></h1>
              <p className="dash-subtitle">Create and manage insurance policy tiers</p>
            </div>
            <button className="btn-logout" onClick={logout}>⏻ Logout</button>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab-btn${activeTab === "create" ? " active" : ""}`}
              onClick={() => setActiveTab("create")}
            >
              + Create Policy
            </button>
            <button
              className={`tab-btn${activeTab === "policies" ? " active" : ""}`}
              onClick={() => setActiveTab("policies")}
            >
              All Policies
            </button>
          </div>

          {/* ── CREATE TAB ── */}
          {activeTab === "create" && (
            <div className="dash-card">

              <div className="section-label">Identity</div>
              <div className="grid-2" style={{ marginBottom: 14 }}>
                <div className="field">
                  <label className="field-required">Policy Name</label>
                  <input
                    className="field-input"
                    placeholder="e.g. Basic Cover"
                    value={form.policy_name}
                    onChange={(e) => set("policy_name", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-required">Policy Tier</label>
                  <div className="tier-group">
                    {TIERS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`tier-btn${form.policy_tier === t ? ` active-${t}` : ""}`}
                        onClick={() => set("policy_tier", t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="field">
                <label>Description</label>
                <textarea
                  className="field-textarea"
                  placeholder="Brief description of this policy tier..."
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>

              <div className="section-label">Pricing</div>
              <div className="grid-2">
                <div className="field">
                  <label className="field-required">Weekly Premium (₹)</label>
                  <input
                    type="number"
                    className="field-input"
                    placeholder="e.g. 150"
                    value={form.weekly_premium}
                    onChange={(e) => set("weekly_premium", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-required">Coverage Amount (₹)</label>
                  <input
                    type="number"
                    className="field-input"
                    placeholder="e.g. 50000"
                    value={form.coverage_amount}
                    onChange={(e) => set("coverage_amount", e.target.value)}
                  />
                </div>
              </div>

              <div className="section-label">Coverage Limits</div>
              <div className="grid-3" style={{ marginBottom: 14 }}>
                <div className="field">
                  <label className="field-required">Max Weekly Payout (₹)</label>
                  <input
                    type="number"
                    className="field-input"
                    placeholder="e.g. 3000"
                    value={form.max_weekly_payout}
                    onChange={(e) => set("max_weekly_payout", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-required">Coverage Hours / Week</label>
                  <input
                    type="number"
                    className="field-input"
                    placeholder="e.g. 40"
                    value={form.coverage_hours_per_week}
                    onChange={(e) => set("coverage_hours_per_week", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-required">Max Claims / Week</label>
                  <input
                    type="number"
                    className="field-input"
                    placeholder="e.g. 3"
                    value={form.max_claims_per_week}
                    onChange={(e) => set("max_claims_per_week", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="field">
                  <label>Min Disruption Hours</label>
                  <input
                    type="number"
                    step="0.1"
                    className="field-input"
                    value={form.min_disruption_hours}
                    onChange={(e) => set("min_disruption_hours", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Income Covered % (0–1)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    className="field-input"
                    value={form.income_covered_pct}
                    onChange={(e) => set("income_covered_pct", e.target.value)}
                  />
                </div>
              </div>

              <div className="section-label">Eligibility</div>
              <div className="grid-2">
                <div className="field">
                  <label>Min Weekly Income (₹)</label>
                  <input
                    type="number"
                    className="field-input"
                    value={form.min_weekly_income}
                    onChange={(e) => set("min_weekly_income", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Max Weekly Income (₹)</label>
                  <input
                    type="number"
                    className="field-input"
                    value={form.max_weekly_income}
                    onChange={(e) => set("max_weekly_income", e.target.value)}
                  />
                </div>
              </div>

              <div className="toggle-row">
                <span className="toggle-label">Policy is Active</span>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => set("is_active", e.target.checked)}
                  />
                  <span className="toggle-track" />
                  <span className="toggle-thumb" />
                </label>
              </div>

              <button className="btn-submit" onClick={addPolicy} disabled={loading}>
                {loading && <span className="spinner" />}
                {loading ? "Creating Policy..." : "Create Policy →"}
              </button>

            </div>
          )}

          {/* ── POLICIES TAB ── */}
          {activeTab === "policies" && (
            <div className="dash-card">
              {policiesLoading ? (
                <div className="empty-state">
                  <div className="spinner" style={{ margin: "0 auto 12px" }} />
                  Loading policies...
                </div>
              ) : policies.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  No policies created yet
                </div>
              ) : (
                <div className="policy-list">
                  {policies.map((p) => (
                    <div className="policy-card" key={p.id}>
                      <div className="policy-card-left">
                        <span
                          className="policy-tier-badge"
                          style={{
                            background: tierColor[p.policy_tier] || "rgba(255,255,255,0.08)",
                            color: tierTextColor[p.policy_tier] || "#94a3b8",
                          }}
                        >
                          {p.policy_tier}
                        </span>
                        <div>
                          <div className="policy-name">{p.policy_name}</div>
                          {p.description && <div className="policy-desc">{p.description}</div>}
                        </div>
                      </div>
                      <div className="policy-card-right">
                        <div className="policy-stat">
                          <div className="policy-stat-val">₹{p.weekly_premium}/wk</div>
                          <div className="policy-stat-label">Premium</div>
                        </div>
                        <div className="policy-stat">
                          <div className="policy-stat-val">₹{p.coverage_amount?.toLocaleString()}</div>
                          <div className="policy-stat-label">Coverage</div>
                        </div>
                        <div className="policy-stat">
                          <div className="policy-stat-val">₹{p.max_weekly_payout?.toLocaleString()}</div>
                          <div className="policy-stat-label">Max/Week</div>
                        </div>
                        <div className="policy-stat">
                          <div className="policy-stat-val">{p.coverage_hours_per_week}h</div>
                          <div className="policy-stat-label">Hrs/Week</div>
                        </div>
                        <span className={`active-pill ${p.is_active ? "on" : "off"}`}>
                          {p.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {success && (
        <div className="toast">✓ Policy created successfully</div>
      )}
    </>
  )
}