"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import API, { runTriggerNow, getTriggerFeed } from "@/services/api"

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

// ── Types ─────────────────────────────────────────────────────────────────────
interface RenewalStats {
  active_enrollments:  number
  auto_renew_enabled:  number
  auto_renew_opt_out:  number
  renewed_count:       number
  expired_count:       number
  suspended_count:     number
  error_count:         number
  renewal_rate_pct:    number
  total_premium_inr:   number
  this_week: { renewed: number; premium_inr: number; week_start: string }
  weekly_trend: { week_start: string; count: number; premium: number }[]
  tier_breakdown: { tier: string; count: number; premium: number }[]
}

interface RenewalRow {
  id: number; user_id: number; outcome: string
  premium_inr: number; week_start: string; policy_tier: string
  zone: string; error_message?: string; processed_at: string
}

interface UpcomingRenewals {
  next_renewal_date: string
  will_renew_count: number
  will_not_renew_count: number
  will_renew: { user_id: number; policy_tier: string; zone: string }[]
  will_not_renew: { user_id: number; policy_tier: string; zone: string; will_expire: boolean }[]
}

// ── Constants ─────────────────────────────────────────────────────────────────
const OUTCOME_STYLE: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  renewed:   { color: "#4ade80", bg: "rgba(74,222,128,.1)",  label: "Renewed",   icon: "✓" },
  expired:   { color: "#f87171", bg: "rgba(239,68,68,.1)",   label: "Expired",   icon: "✕" },
  suspended: { color: "#fbbf24", bg: "rgba(251,191,36,.1)",  label: "Suspended", icon: "⏸" },
  skipped:   { color: "#60a5fa", bg: "rgba(96,165,250,.08)", label: "Skipped",   icon: "→" },
  error:     { color: "#f87171", bg: "rgba(239,68,68,.08)",  label: "Error",     icon: "!" },
}

const TIER_COLOR: Record<string, string> = {
  basic:    "rgba(59,130,246,0.15)",
  standard: "rgba(249,115,22,0.15)",
  premium:  "rgba(168,85,247,0.15)",
}

const TIER_TEXT: Record<string, string> = {
  basic:    "#60a5fa",
  standard: "#fb923c",
  premium:  "#c084fc",
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const w = 120, h = 32, pad = 2
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1 || 1)) * (w - pad * 2)
    const y = h - pad - (v / max) * (h - pad * 2)
    return `${x},${y}`
  }).join(" ")
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke="#4ade80" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const router = useRouter()

  // Form state
  const [form,    setForm]   = useState({ ...defaultForm })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // Policies state
  const [policies,        setPolicies]        = useState<any[]>([])
  const [activeTab,       setActiveTab]        = useState<"create" | "policies" | "renewals">("create")
  const [policiesLoading, setPoliciesLoading]  = useState(false)

  // Trigger state
  const [triggerStats,   setTriggerStats]   = useState<any>(null)
  const [triggerFeed,    setTriggerFeed]    = useState<any[]>([])
  const [triggerLoading, setTriggerLoading] = useState(false)

  // Renewal state
  const [renewalStats,   setRenewalStats]   = useState<RenewalStats | null>(null)
  const [renewalHistory, setRenewalHistory] = useState<RenewalRow[]>([])
  const [upcoming,       setUpcoming]       = useState<UpcomingRenewals | null>(null)
  const [renewalLoading, setRenewalLoading] = useState(false)
  const [renewalRunning, setRenewalRunning] = useState(false)
  const [renewalResult,  setRenewalResult]  = useState<any>(null)

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("admin_token")
    if (!token) router.push("/admin/login")
  }, [])

  // ── Tab-driven data loads ─────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === "policies") fetchPolicies()
    if (activeTab === "renewals") fetchRenewalData()
  }, [activeTab])

  // ── Auto-refresh trigger feed every 5 s ───────────────────────────────────
  useEffect(() => {
    fetchTriggerFeed()
    const interval = setInterval(fetchTriggerFeed, 5000)
    return () => clearInterval(interval)
  }, [])

  // ── Renewal data ──────────────────────────────────────────────────────────
  const fetchRenewalData = useCallback(async () => {
    setRenewalLoading(true)
    try {
      const [statsRes, histRes, upRes] = await Promise.all([
        API.get("/renewals/stats"),
        API.get("/renewals/history?limit=30"),
        API.get("/renewals/upcoming"),
      ])
      setRenewalStats(statsRes.data)
      setRenewalHistory(histRes.data?.rows || [])
      setUpcoming(upRes.data)
    } catch (e) {
      console.error("Renewal fetch failed:", e)
    } finally {
      setRenewalLoading(false)
    }
  }, [])

  const runRenewalNow = async () => {
    setRenewalRunning(true)
    setRenewalResult(null)
    try {
      const res = await API.post("/renewals/run-now")
      setRenewalResult(res.data?.summary)
      fetchRenewalData()
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Renewal cycle failed")
    } finally {
      setRenewalRunning(false)
    }
  }

  // ── Policies ──────────────────────────────────────────────────────────────
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

  // ── Trigger engine ────────────────────────────────────────────────────────
  const runTrigger = async () => {
    try {
      setTriggerLoading(true)
      const data = await runTriggerNow()
      setTriggerStats(data)
      fetchTriggerFeed()
    } catch {
      alert("Trigger failed")
    } finally {
      setTriggerLoading(false)
    }
  }

  const fetchTriggerFeed = async () => {
    try {
      const data = await getTriggerFeed()
      setTriggerFeed(data.events || [])
    } catch {
      /* silent — feed may be empty on first load */
    }
  }

  // ── Form helpers ──────────────────────────────────────────────────────────
  const set = (key: string, value: any) =>
    setForm((f) => ({ ...f, [key]: value }))

  const addPolicy = async () => {
    const token = localStorage.getItem("admin_token")
    if (!token) { router.push("/admin/login"); return }

    if (
      !form.policy_name || !form.weekly_premium || !form.coverage_amount ||
      !form.max_weekly_payout || !form.coverage_hours_per_week || !form.max_claims_per_week
    ) {
      alert("Please fill in all required fields")
      return
    }

    try {
      setLoading(true)
      await API.post(
        "/policy/create",
        {
          policy_name:            form.policy_name,
          policy_tier:            form.policy_tier,
          description:            form.description,
          weekly_premium:         Number(form.weekly_premium),
          coverage_amount:        Number(form.coverage_amount),
          max_weekly_payout:      Number(form.max_weekly_payout),
          coverage_hours_per_week: Number(form.coverage_hours_per_week),
          max_claims_per_week:    Number(form.max_claims_per_week),
          min_disruption_hours:   Number(form.min_disruption_hours),
          income_covered_pct:     Number(form.income_covered_pct),
          min_weekly_income:      Number(form.min_weekly_income),
          max_weekly_income:      Number(form.max_weekly_income),
          is_active:              form.is_active,
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }

        .dash-page { min-height:100vh; background:#05070a; font-family:'DM Sans',sans-serif; color:#e8eaf0; }
        .dash-body  { max-width:900px; margin:0 auto; padding:48px 24px 80px; }

        /* Header */
        .dash-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:36px; flex-wrap:wrap; gap:16px; }
        .dash-badge  { display:inline-flex; align-items:center; gap:7px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); color:#ef4444; font-size:10px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; padding:5px 12px; border-radius:100px; margin-bottom:16px; }
        .badge-dot   { width:5px; height:5px; border-radius:50%; background:#ef4444; animation:pulse 2s ease-in-out infinite; }
        .dash-title  { font-family:'Bebas Neue',sans-serif; font-size:48px; letter-spacing:.04em; line-height:1; color:#e8eaf0; margin:0 0 8px; }
        .dash-title span { background:linear-gradient(135deg,#ef4444,#f97316); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .dash-subtitle { font-size:14px; color:#475569; }
        .dash-header-actions { display:flex; flex-direction:column; align-items:flex-end; gap:10px; }

        /* Header buttons */
        .btn-fraud { display:inline-flex; align-items:center; gap:8px; padding:10px 18px; border-radius:10px; border:1px solid rgba(239,68,68,.35); background:rgba(239,68,68,.10); color:#f87171; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all .2s; white-space:nowrap; }
        .btn-fraud:hover { background:rgba(239,68,68,.20); border-color:rgba(239,68,68,.55); transform:translateY(-1px); box-shadow:0 4px 14px rgba(239,68,68,.2); }
        .fraud-pulse { width:7px; height:7px; border-radius:50%; background:#ef4444; animation:pulse 1.5s ease-in-out infinite; flex-shrink:0; }
        .btn-logout { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:10px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03); color:#475569; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:background .2s,border-color .2s; white-space:nowrap; }
        .btn-logout:hover { background:rgba(255,255,255,.07); color:#94a3b8; }

        /* Tabs */
        .tabs { display:flex; gap:4px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); border-radius:12px; padding:4px; margin-bottom:28px; }
        .tab-btn { flex:1; padding:10px 16px; border:none; border-radius:9px; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all .2s; background:transparent; color:#475569; letter-spacing:.02em; }
        .tab-btn.active { background:#0f1318; color:#e8eaf0; box-shadow:0 2px 8px rgba(0,0,0,.3); }

        /* Cards */
        .dash-card { position:relative; background:#0f1318; border:1px solid rgba(255,255,255,.07); border-radius:20px; padding:36px; box-shadow:0 24px 64px rgba(0,0,0,.5); }
        .dash-card::before { content:''; position:absolute; top:0; left:10%; right:10%; height:2px; background:linear-gradient(90deg,transparent,#ef4444,transparent); border-radius:0 0 4px 4px; }

        /* Section labels */
        .section-label { font-size:10px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:#334155; margin:28px 0 16px; display:flex; align-items:center; gap:10px; }
        .section-label:first-child { margin-top:0; }
        .section-label::after { content:''; flex:1; height:1px; background:rgba(255,255,255,.06); }

        /* Grids */
        .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
        .grid-4 { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px; }

        /* Form fields */
        .field { display:flex; flex-direction:column; gap:7px; }
        .field label { font-size:11px; font-weight:600; letter-spacing:.09em; text-transform:uppercase; color:#475569; }
        .field-required::after { content:' *'; color:#ef4444; }
        .field-input, .field-textarea { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09); border-radius:10px; padding:11px 14px; font-family:'DM Sans',sans-serif; font-size:14px; color:#e8eaf0; outline:none; transition:border-color .2s,background .2s,box-shadow .2s; width:100%; }
        .field-input::placeholder, .field-textarea::placeholder { color:#2d3a4a; }
        .field-input:focus, .field-textarea:focus { border-color:rgba(239,68,68,.45); background:rgba(239,68,68,.03); box-shadow:0 0 0 3px rgba(239,68,68,.07); }
        .field-textarea { resize:vertical; min-height:80px; }

        /* Tier buttons */
        .tier-group { display:flex; gap:10px; }
        .tier-btn { flex:1; padding:10px 8px; border-radius:10px; border:1px solid rgba(255,255,255,.09); background:rgba(255,255,255,.03); color:#475569; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; letter-spacing:.05em; text-transform:capitalize; cursor:pointer; transition:all .2s; }
        .tier-btn:hover { color:#94a3b8; border-color:rgba(255,255,255,.18); }
        .tier-btn.active-basic    { background:rgba(59,130,246,.12); border-color:rgba(59,130,246,.4); color:#60a5fa; }
        .tier-btn.active-standard { background:rgba(249,115,22,.12);  border-color:rgba(249,115,22,.4);  color:#fb923c; }
        .tier-btn.active-premium  { background:rgba(168,85,247,.12);  border-color:rgba(168,85,247,.4);  color:#c084fc; }

        /* Toggle */
        .toggle-row { display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:10px; padding:12px 16px; margin-top:14px; }
        .toggle-label { font-size:13px; font-weight:500; color:#94a3b8; }
        .toggle { position:relative; width:42px; height:24px; cursor:pointer; }
        .toggle input { display:none; }
        .toggle-track { position:absolute; inset:0; border-radius:100px; background:rgba(255,255,255,.08); transition:background .2s; }
        .toggle input:checked ~ .toggle-track { background:#ef4444; }
        .toggle-thumb { position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#fff; transition:transform .2s; box-shadow:0 1px 4px rgba(0,0,0,.3); }
        .toggle input:checked ~ .toggle-thumb { transform:translateX(18px); }

        /* Action buttons */
        .btn-submit { width:100%; padding:15px; margin-top:28px; border:none; border-radius:12px; background:linear-gradient(135deg,#ef4444,#dc2626); color:#fff; font-family:'DM Sans',sans-serif; font-size:15px; font-weight:700; letter-spacing:.04em; cursor:pointer; transition:transform .18s,box-shadow .18s; box-shadow:0 4px 20px rgba(239,68,68,.3); display:flex; align-items:center; justify-content:center; gap:10px; }
        .btn-submit:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 28px rgba(239,68,68,.4); }
        .btn-submit:disabled { opacity:.55; cursor:not-allowed; }

        .btn-trigger { width:100%; padding:13px; border:none; border-radius:12px; background:linear-gradient(135deg,#f97316,#ea580c); color:#fff; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:700; letter-spacing:.04em; cursor:pointer; transition:transform .18s,box-shadow .18s; box-shadow:0 4px 20px rgba(249,115,22,.25); display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:20px; }
        .btn-trigger:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 28px rgba(249,115,22,.35); }
        .btn-trigger:disabled { opacity:.55; cursor:not-allowed; }

        .btn-renew { width:100%; padding:13px; border:none; border-radius:12px; background:linear-gradient(135deg,#22c55e,#16a34a); color:#fff; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:700; letter-spacing:.04em; cursor:pointer; transition:transform .18s,box-shadow .18s; box-shadow:0 4px 20px rgba(34,197,94,.2); display:flex; align-items:center; justify-content:center; gap:10px; }
        .btn-renew:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 24px rgba(34,197,94,.3); }
        .btn-renew:disabled { opacity:.55; cursor:not-allowed; }

        /* Trigger stats */
        .trigger-stats { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:4px; }
        .trigger-stat-item { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:10px; padding:12px 14px; font-size:13px; color:#94a3b8; display:flex; align-items:center; gap:8px; }
        .trigger-stat-item b { color:#e8eaf0; font-size:15px; margin-left:auto; }

        /* Renewal KPI cards */
        .renewal-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
        .renewal-kpi { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:16px; position:relative; overflow:hidden; }
        .renewal-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; }
        .renewal-kpi.green::before { background:linear-gradient(90deg,#22c55e,transparent); }
        .renewal-kpi.red::before   { background:linear-gradient(90deg,#ef4444,transparent); }
        .renewal-kpi.amber::before { background:linear-gradient(90deg,#f59e0b,transparent); }
        .renewal-kpi.blue::before  { background:linear-gradient(90deg,#3b82f6,transparent); }
        .renewal-kpi-val  { font-family:'Bebas Neue',sans-serif; font-size:34px; letter-spacing:.04em; line-height:1; }
        .renewal-kpi-key  { font-size:10px; color:#475569; text-transform:uppercase; letter-spacing:.1em; margin-top:4px; }
        .renewal-kpi-sub  { font-size:11px; margin-top:6px; }

        /* This-week callout */
        .week-callout { background:rgba(34,197,94,.05); border:1px solid rgba(34,197,94,.15); border-radius:12px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px; }
        .week-callout-label { font-size:11px; color:#475569; text-transform:uppercase; letter-spacing:.1em; }
        .week-callout-val   { font-family:'Bebas Neue',sans-serif; font-size:28px; letter-spacing:.04em; }

        /* Tier breakdown */
        .tier-breakdown { display:flex; flex-direction:column; gap:8px; margin-bottom:20px; }
        .tier-breakdown-row { display:flex; align-items:center; gap:10px; }
        .tier-breakdown-label { font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; text-transform:capitalize; min-width:68px; text-align:center; }
        .tier-breakdown-track { flex:1; height:5px; background:rgba(255,255,255,.06); border-radius:3px; overflow:hidden; }
        .tier-breakdown-fill  { height:100%; border-radius:3px; transition:width .8s ease; }
        .tier-breakdown-count   { font-size:11px; color:#475569; min-width:24px; text-align:right; }
        .tier-breakdown-premium { font-size:11px; color:#64748b; min-width:60px; text-align:right; }

        /* Upcoming panel */
        .upcoming-split { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }
        .upcoming-col   { background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.06); border-radius:12px; padding:14px; }
        .upcoming-col-title { font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; margin-bottom:10px; }
        .upcoming-row { font-size:12px; color:#94a3b8; padding:5px 0; border-bottom:1px solid rgba(255,255,255,.04); display:flex; justify-content:space-between; }
        .upcoming-row:last-child { border-bottom:none; }

        /* History table */
        .history-table { width:100%; border-collapse:collapse; }
        .history-table th { font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#334155; padding:8px 10px; text-align:left; border-bottom:1px solid rgba(255,255,255,.06); }
        .history-table td { font-size:12px; color:#94a3b8; padding:10px 10px; border-bottom:1px solid rgba(255,255,255,.04); vertical-align:middle; }
        .history-table tr:last-child td { border-bottom:none; }
        .outcome-badge { display:inline-flex; align-items:center; gap:5px; padding:2px 8px; border-radius:100px; font-size:10px; font-weight:700; letter-spacing:.08em; }

        /* Live feed */
        .feed-row { padding:12px 0; border-bottom:1px solid rgba(255,255,255,.05); display:flex; justify-content:space-between; align-items:center; font-size:13px; gap:12px; }
        .feed-row:last-child { border-bottom:none; }
        .feed-left   { color:#94a3b8; display:flex; align-items:center; gap:8px; }
        .feed-right  { display:flex; align-items:center; gap:10px; white-space:nowrap; }
        .feed-amount { color:#e8eaf0; font-weight:600; }
        .feed-status-approved { color:#4ade80; font-weight:700; font-size:11px; letter-spacing:.06em; text-transform:uppercase; }
        .feed-status-held     { color:#f87171; font-weight:700; font-size:11px; letter-spacing:.06em; text-transform:uppercase; }
        .feed-status-default  { color:#94a3b8; font-weight:700; font-size:11px; letter-spacing:.06em; text-transform:uppercase; }

        /* Policy list */
        .policy-list { display:flex; flex-direction:column; gap:12px; }
        .policy-card { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:18px 20px; display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
        .policy-card-left { display:flex; align-items:center; gap:14px; flex:1; min-width:0; }
        .policy-tier-badge { padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; white-space:nowrap; flex-shrink:0; }
        .policy-name { font-size:15px; font-weight:600; color:#e8eaf0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .policy-desc { font-size:12px; color:#475569; margin-top:2px; }
        .policy-card-right { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
        .policy-stat { text-align:right; }
        .policy-stat-val   { font-size:15px; font-weight:600; color:#e8eaf0; white-space:nowrap; }
        .policy-stat-label { font-size:11px; color:#334155; text-transform:uppercase; letter-spacing:.06em; }
        .active-pill { padding:3px 10px; border-radius:100px; font-size:11px; font-weight:600; letter-spacing:.06em; white-space:nowrap; }
        .active-pill.on  { background:rgba(34,197,94,.12); color:#4ade80; border:1px solid rgba(34,197,94,.25); }
        .active-pill.off { background:rgba(239,68,68,.1);  color:#f87171; border:1px solid rgba(239,68,68,.2); }

        /* Misc */
        .spinner { width:16px; height:16px; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; }
        .empty-state { text-align:center; padding:60px 20px; color:#334155; font-size:14px; }
        .empty-icon  { font-size:40px; margin-bottom:12px; }
        .toast { position:fixed; bottom:24px; right:24px; left:24px; max-width:340px; margin:0 auto; background:#0f1318; border:1px solid rgba(34,197,94,.3); border-radius:12px; padding:14px 20px; display:flex; align-items:center; gap:10px; font-size:14px; font-weight:500; color:#4ade80; box-shadow:0 8px 32px rgba(0,0,0,.5); animation:slideUp .3s ease; z-index:999; }

        @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin    { to { transform:rotate(360deg); } }
        @keyframes pulse   { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.4; transform:scale(.8); } }

        @media (max-width:768px) {
          .dash-body { padding:32px 16px 60px; }
          .dash-title { font-size:40px; }
          .dash-card  { padding:28px 20px; }
          .grid-3 { grid-template-columns:1fr 1fr; }
          .renewal-kpis { grid-template-columns:1fr 1fr; }
          .upcoming-split { grid-template-columns:1fr; }
        }
        @media (max-width:560px) {
          .dash-body  { padding:24px 14px 60px; }
          .dash-title { font-size:34px; }
          .dash-card  { padding:22px 16px; }
          .grid-2, .grid-3, .grid-4 { grid-template-columns:1fr; }
          .renewal-kpis { grid-template-columns:1fr 1fr; }
          .tier-group { flex-wrap:wrap; }
          .tier-btn   { min-width:calc(50% - 5px); }
          .policy-card { flex-direction:column; align-items:flex-start; gap:12px; }
          .policy-card-right { width:100%; justify-content:flex-start; gap:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,.06); }
          .policy-stat { text-align:left; }
          .field-input, .field-textarea { font-size:16px; }
          .toast { left:14px; right:14px; max-width:100%; }
          .dash-header-actions { flex-direction:row; flex-wrap:wrap; justify-content:flex-end; }
          .trigger-stats { grid-template-columns:1fr; }
          .feed-row  { flex-direction:column; align-items:flex-start; gap:6px; }
          .feed-right { width:100%; justify-content:space-between; }
        }
        @media (max-width:380px) {
          .dash-title { font-size:28px; }
          .tab-btn    { font-size:12px; padding:9px 10px; }
          .tier-btn   { min-width:100%; }
        }
      `}</style>

      <div className="dash-page">
        <div className="dash-body">

          {/* ── Header ───────────────────────────────────────────────────── */}
          <div className="dash-header">
            <div>
              <div className="dash-badge"><span className="badge-dot" />Admin Dashboard</div>
              <h1 className="dash-title">Policy<br /><span>Management</span></h1>
              <p className="dash-subtitle">Create and manage insurance policy tiers</p>
            </div>
            <div className="dash-header-actions">
              <button className="btn-fraud" onClick={() => router.push("/admin/fraud")}>
                <span className="fraud-pulse" />🛡️ Fraud Panel
              </button>
              <button className="btn-logout" onClick={logout}>⏻ Logout</button>
            </div>
          </div>

          {/* ── Tabs ─────────────────────────────────────────────────────── */}
          <div className="tabs">
            {(["create", "policies", "renewals"] as const).map((t) => (
              <button
                key={t}
                className={`tab-btn${activeTab === t ? " active" : ""}`}
                onClick={() => setActiveTab(t)}
              >
                {t === "create" ? "+ Create Policy" : t === "policies" ? "All Policies" : "🔄 Renewals"}
              </button>
            ))}
          </div>

          {/* ── Trigger Engine — always visible ──────────────────────────── */}
          <div className="dash-card" style={{ marginBottom: 24 }}>
            <div className="section-label">Trigger Engine</div>
            <button className="btn-trigger" onClick={runTrigger} disabled={triggerLoading}>
              {triggerLoading ? <><span className="spinner" /> Running…</> : "⚡ Run Trigger Cycle"}
            </button>
            {triggerStats && (
              <div className="trigger-stats">
                <div className="trigger-stat-item">👥 Drivers Checked <b>{triggerStats.drivers_checked}</b></div>
                <div className="trigger-stat-item">⚡ Triggers Fired  <b>{triggerStats.triggers_fired}</b></div>
                <div className="trigger-stat-item">✅ Approved        <b>{triggerStats.payouts_approved}</b></div>
                <div className="trigger-stat-item">⛔ Held            <b>{triggerStats.payouts_held}</b></div>
              </div>
            )}
          </div>

          {/* ── Live Trigger Feed — always visible ───────────────────────── */}
          <div className="dash-card" style={{ marginBottom: 24 }}>
            <div className="section-label">Live Trigger Feed</div>
            {triggerFeed.length === 0 ? (
              <div className="empty-state" style={{ padding: "32px 20px" }}>
                <div className="empty-icon">📡</div>No events yet
              </div>
            ) : (
              triggerFeed.map((event, i) => (
                <div className="feed-row" key={i}>
                  <span className="feed-left">
                    👤 User {event.user_id}
                    <span style={{ color: "#334155", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em" }}>
                      {event.event_type}
                    </span>
                  </span>
                  <span className="feed-right">
                    <span className="feed-amount">₹{event.payout_amount}</span>
                    <span className={
                      event.status === "approved" ? "feed-status-approved"
                      : event.status === "held"   ? "feed-status-held"
                      : "feed-status-default"
                    }>{event.status}</span>
                  </span>
                </div>
              ))
            )}
          </div>

          {/* ── RENEWALS TAB ─────────────────────────────────────────────── */}
          {activeTab === "renewals" && (
            <div className="dash-card">

              <button className="btn-renew" onClick={runRenewalNow} disabled={renewalRunning}
                style={{ marginBottom: 20 }}>
                {renewalRunning
                  ? <><span className="spinner" /> Processing Renewals…</>
                  : "🔄 Process Renewals Now"}
              </button>

              {renewalResult && (
                <div className="trigger-stats" style={{ marginBottom: 20 }}>
                  <div className="trigger-stat-item">✅ Renewed   <b>{renewalResult.renewed}</b></div>
                  <div className="trigger-stat-item">💰 Premium   <b>₹{renewalResult.total_premium_inr?.toFixed(0)}</b></div>
                  <div className="trigger-stat-item">⌛ Expired   <b>{renewalResult.expired}</b></div>
                  <div className="trigger-stat-item">⏸ Suspended <b>{renewalResult.suspended}</b></div>
                </div>
              )}

              {renewalLoading ? (
                <div className="empty-state">
                  <span className="spinner" style={{ margin: "0 auto 12px" }} />Loading renewal data…
                </div>
              ) : renewalStats ? (
                <>
                  <div className="section-label">This Week</div>
                  <div className="week-callout">
                    <div>
                      <div className="week-callout-label">Week starting {renewalStats.this_week.week_start}</div>
                      <div className="week-callout-val" style={{ color: "#4ade80" }}>
                        {renewalStats.this_week.renewed} Renewed
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="week-callout-label">Premium collected</div>
                      <div className="week-callout-val" style={{ color: "#4ade80" }}>
                        ₹{renewalStats.this_week.premium_inr.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="week-callout-label">Trend (8 weeks)</div>
                      <Sparkline data={renewalStats.weekly_trend.map((w) => w.count)} />
                    </div>
                  </div>

                  <div className="section-label">4-Week Summary</div>
                  <div className="renewal-kpis">
                    <div className="renewal-kpi green">
                      <div className="renewal-kpi-val" style={{ color: "#4ade80" }}>{renewalStats.renewed_count}</div>
                      <div className="renewal-kpi-key">Renewed</div>
                      <div className="renewal-kpi-sub" style={{ color: "#4ade80" }}>{renewalStats.renewal_rate_pct}% rate</div>
                    </div>
                    <div className="renewal-kpi blue">
                      <div className="renewal-kpi-val" style={{ color: "#60a5fa" }}>{renewalStats.active_enrollments}</div>
                      <div className="renewal-kpi-key">Active Policies</div>
                      <div className="renewal-kpi-sub" style={{ color: "#60a5fa" }}>{renewalStats.auto_renew_enabled} auto-on</div>
                    </div>
                    <div className="renewal-kpi green">
                      <div className="renewal-kpi-val" style={{ color: "#4ade80" }}>₹{renewalStats.total_premium_inr.toLocaleString()}</div>
                      <div className="renewal-kpi-key">Premium Collected</div>
                      <div className="renewal-kpi-sub" style={{ color: "#4ade80" }}>4 weeks</div>
                    </div>
                    <div className="renewal-kpi amber">
                      <div className="renewal-kpi-val" style={{ color: "#fbbf24" }}>{renewalStats.expired_count + renewalStats.suspended_count}</div>
                      <div className="renewal-kpi-key">Lapsed</div>
                      <div className="renewal-kpi-sub" style={{ color: "#fbbf24" }}>
                        {renewalStats.expired_count} expired · {renewalStats.suspended_count} suspended
                      </div>
                    </div>
                  </div>

                  {renewalStats.tier_breakdown.length > 0 && (
                    <>
                      <div className="section-label">By Tier</div>
                      <div className="tier-breakdown">
                        {renewalStats.tier_breakdown.map((t) => {
                          const max = renewalStats.tier_breakdown[0].count
                          return (
                            <div key={t.tier} className="tier-breakdown-row">
                              <span className="tier-breakdown-label"
                                style={{ background: TIER_COLOR[t.tier], color: TIER_TEXT[t.tier] }}>
                                {t.tier}
                              </span>
                              <div className="tier-breakdown-track">
                                <div className="tier-breakdown-fill"
                                  style={{ width: `${Math.round(t.count / max * 100)}%`, background: TIER_TEXT[t.tier] }} />
                              </div>
                              <span className="tier-breakdown-count">{t.count}</span>
                              <span className="tier-breakdown-premium">₹{t.premium.toLocaleString()}</span>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {upcoming && (
                    <>
                      <div className="section-label">
                        Upcoming — Next Monday {upcoming.next_renewal_date}
                      </div>
                      <div className="upcoming-split">
                        <div className="upcoming-col">
                          <div className="upcoming-col-title" style={{ color: "#4ade80" }}>
                            ✓ Will Renew ({upcoming.will_renew_count})
                          </div>
                          {upcoming.will_renew.slice(0, 8).map((r, i) => (
                            <div key={i} className="upcoming-row">
                              <span>User #{r.user_id}</span>
                              <span style={{ color: TIER_TEXT[r.policy_tier] || "#94a3b8", fontSize: 10, textTransform: "capitalize" }}>
                                {r.policy_tier}
                              </span>
                            </div>
                          ))}
                          {upcoming.will_renew_count > 8 &&
                            <div style={{ fontSize: 11, color: "#334155", paddingTop: 6 }}>
                              +{upcoming.will_renew_count - 8} more
                            </div>}
                        </div>
                        <div className="upcoming-col">
                          <div className="upcoming-col-title" style={{ color: "#f87171" }}>
                            ✕ Will Not Renew ({upcoming.will_not_renew_count})
                          </div>
                          {upcoming.will_not_renew.slice(0, 8).map((r, i) => (
                            <div key={i} className="upcoming-row">
                              <span>User #{r.user_id}</span>
                              <span style={{ fontSize: 10, color: r.will_expire ? "#f87171" : "#fbbf24" }}>
                                {r.will_expire ? "Expires" : "Opted out"}
                              </span>
                            </div>
                          ))}
                          {upcoming.will_not_renew_count > 8 &&
                            <div style={{ fontSize: 11, color: "#334155", paddingTop: 6 }}>
                              +{upcoming.will_not_renew_count - 8} more
                            </div>}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="section-label">Recent History</div>
                  {renewalHistory.length === 0 ? (
                    <div className="empty-state" style={{ padding: "24px" }}>
                      No renewal cycles run yet — click "Process Renewals Now" above
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table className="history-table">
                        <thead>
                          <tr>
                            <th>User</th><th>Outcome</th><th>Tier</th>
                            <th>Premium</th><th>Zone</th><th>Week</th><th>When</th>
                          </tr>
                        </thead>
                        <tbody>
                          {renewalHistory.map((r) => {
                            const os = OUTCOME_STYLE[r.outcome] || OUTCOME_STYLE.error
                            return (
                              <tr key={r.id}>
                                <td>#{r.user_id}</td>
                                <td>
                                  <span className="outcome-badge" style={{ background: os.bg, color: os.color }}>
                                    {os.icon} {os.label}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: TIER_TEXT[r.policy_tier] || "#94a3b8", textTransform: "capitalize" }}>
                                    {r.policy_tier || "—"}
                                  </span>
                                </td>
                                <td style={{ color: "#e8eaf0" }}>{r.premium_inr > 0 ? `₹${r.premium_inr.toFixed(0)}` : "—"}</td>
                                <td>{r.zone || "—"}</td>
                                <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.week_start}</td>
                                <td style={{ fontFamily: "monospace", fontSize: 10, color: "#475569" }}>
                                  {r.processed_at ? timeAgo(r.processed_at) : "—"}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">🔄</div>No renewal data yet
                </div>
              )}
            </div>
          )}

          {/* ── CREATE TAB ───────────────────────────────────────────────── */}
          {activeTab === "create" && (
            <div className="dash-card">
              <div className="section-label">Identity</div>
              <div className="grid-2" style={{ marginBottom: 14 }}>
                <div className="field">
                  <label className="field-required">Policy Name</label>
                  <input className="field-input" placeholder="e.g. Basic Cover"
                    value={form.policy_name} onChange={(e) => set("policy_name", e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-required">Policy Tier</label>
                  <div className="tier-group">
                    {TIERS.map((t) => (
                      <button key={t} type="button"
                        className={`tier-btn${form.policy_tier === t ? ` active-${t}` : ""}`}
                        onClick={() => set("policy_tier", t)}>{t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="field">
                <label>Description</label>
                <textarea className="field-textarea" placeholder="Brief description of this policy tier..."
                  value={form.description} onChange={(e) => set("description", e.target.value)} />
              </div>

              <div className="section-label">Pricing</div>
              <div className="grid-2">
                <div className="field">
                  <label className="field-required">Weekly Premium (₹)</label>
                  <input type="number" className="field-input" placeholder="e.g. 150"
                    value={form.weekly_premium} onChange={(e) => set("weekly_premium", e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-required">Coverage Amount (₹)</label>
                  <input type="number" className="field-input" placeholder="e.g. 50000"
                    value={form.coverage_amount} onChange={(e) => set("coverage_amount", e.target.value)} />
                </div>
              </div>

              <div className="section-label">Coverage Limits</div>
              <div className="grid-3" style={{ marginBottom: 14 }}>
                <div className="field">
                  <label className="field-required">Max Weekly Payout (₹)</label>
                  <input type="number" className="field-input" placeholder="e.g. 3000"
                    value={form.max_weekly_payout} onChange={(e) => set("max_weekly_payout", e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-required">Coverage Hours / Week</label>
                  <input type="number" className="field-input" placeholder="e.g. 40"
                    value={form.coverage_hours_per_week} onChange={(e) => set("coverage_hours_per_week", e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-required">Max Claims / Week</label>
                  <input type="number" className="field-input" placeholder="e.g. 3"
                    value={form.max_claims_per_week} onChange={(e) => set("max_claims_per_week", e.target.value)} />
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Min Disruption Hours</label>
                  <input type="number" step="0.1" className="field-input"
                    value={form.min_disruption_hours} onChange={(e) => set("min_disruption_hours", e.target.value)} />
                </div>
                <div className="field">
                  <label>Income Covered % (0–1)</label>
                  <input type="number" step="0.01" min="0" max="1" className="field-input"
                    value={form.income_covered_pct} onChange={(e) => set("income_covered_pct", e.target.value)} />
                </div>
              </div>

              <div className="section-label">Eligibility</div>
              <div className="grid-2">
                <div className="field">
                  <label>Min Weekly Income (₹)</label>
                  <input type="number" className="field-input"
                    value={form.min_weekly_income} onChange={(e) => set("min_weekly_income", e.target.value)} />
                </div>
                <div className="field">
                  <label>Max Weekly Income (₹)</label>
                  <input type="number" className="field-input"
                    value={form.max_weekly_income} onChange={(e) => set("max_weekly_income", e.target.value)} />
                </div>
              </div>

              <div className="toggle-row">
                <span className="toggle-label">Policy is Active</span>
                <label className="toggle">
                  <input type="checkbox" checked={form.is_active}
                    onChange={(e) => set("is_active", e.target.checked)} />
                  <span className="toggle-track" /><span className="toggle-thumb" />
                </label>
              </div>
              <button className="btn-submit" onClick={addPolicy} disabled={loading}>
                {loading && <span className="spinner" />}
                {loading ? "Creating Policy..." : "Create Policy →"}
              </button>
            </div>
          )}

          {/* ── POLICIES TAB ─────────────────────────────────────────────── */}
          {activeTab === "policies" && (
            <div className="dash-card">
              {policiesLoading ? (
                <div className="empty-state">
                  <span className="spinner" style={{ margin: "0 auto 12px" }} />Loading policies…
                </div>
              ) : policies.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">📋</div>No policies created yet</div>
              ) : (
                <div className="policy-list">
                  {policies.map((p) => (
                    <div className="policy-card" key={p.id}>
                      <div className="policy-card-left">
                        <span className="policy-tier-badge"
                          style={{ background: TIER_COLOR[p.policy_tier] || "rgba(255,255,255,.08)", color: TIER_TEXT[p.policy_tier] || "#94a3b8" }}>
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

      {success && <div className="toast">✓ Policy created successfully</div>}
    </>
  )
}