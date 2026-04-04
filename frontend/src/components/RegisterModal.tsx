"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import API from "@/services/api"

interface RegisterModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchToLogin?: () => void
}

export default function RegisterModal({ isOpen, onClose, onSwitchToLogin }: RegisterModalProps) {
  const router = useRouter()

  const [fullName, setFullName]       = useState("")
  const [partnerId, setPartnerId]     = useState("")
  const [email, setEmail]             = useState("")
  const [password, setPassword]       = useState("")
  const [platform, setPlatform]       = useState("")
  const [age, setAge]                 = useState("")
  const [zone, setZone]               = useState("")
  const [vehicleType, setVehicleType] = useState("")
  const [loading, setLoading]         = useState(false)
  const [showPass, setShowPass]       = useState(false)

  const register = async () => {
    if (!fullName || !partnerId || !email || !password || !platform || !age || !zone || !vehicleType) {
      alert("Please fill all fields")
      return
    }
    try {
      setLoading(true)
      await API.post("/auth/register", {
        full_name:           fullName,
        delivery_partner_id: partnerId,
        email,
        password,
        platform:            platform.toLowerCase(),   // ← FIX: "Zomato" → "zomato"
        age:                 Number(age),
        zone:                zone.toLowerCase(),        // ← FIX: safety lowercase
        vehicle_type:        vehicleType,
      })

      // ── Store in localStorage so Navbar badge shows immediately after login ──
      localStorage.setItem("user_platform", platform.toLowerCase())
      localStorage.setItem("user_zone",     zone.toLowerCase())
      // ─────────────────────────────────────────────────────────────────────────

      if (onSwitchToLogin) {
        onSwitchToLogin()
      } else {
        onClose()
      }
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  if (typeof window !== "undefined" && isOpen) {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handleKey, { once: true })
  }

  if (!isOpen) return null

  const filledCount = [fullName, partnerId, email, platform, age, zone, vehicleType, password].filter(Boolean).length

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        .reg-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(5,7,10,0.85);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: regOverlayIn 0.2s ease both;
          font-family: 'DM Sans', sans-serif;
          overflow-y: auto;
        }

        .reg-panel {
          position: relative;
          width: 100%;
          max-width: 520px;
          background: #0f1318;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 44px 40px 40px;
          box-shadow:
            0 0 0 1px rgba(34,197,94,0.06),
            0 32px 80px rgba(0,0,0,0.6);
          animation: regPanelIn 0.3s cubic-bezier(0.34,1.4,0.64,1) both;
          margin: auto;
        }

        .reg-panel::before {
          content: '';
          position: absolute;
          top: 0; left: 10%; right: 10%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #22c55e, transparent);
          border-radius: 0 0 4px 4px;
        }

        .reg-close {
          position: absolute;
          top: 14px; right: 14px;
          width: 32px; height: 32px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: #64748b;
          font-size: 16px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.2s, color 0.2s;
          flex-shrink: 0;
        }
        .reg-close:hover { background: rgba(255,255,255,0.1); color: #e8eaf0; }

        .reg-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.2);
          color: #4ade80;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 5px 12px;
          border-radius: 100px;
          margin-bottom: 18px;
        }

        .reg-eyebrow-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #4ade80;
          animation: regPulse 2s ease-in-out infinite;
          flex-shrink: 0;
        }

        .reg-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(32px, 6vw, 42px);
          letter-spacing: 0.03em;
          line-height: 1;
          color: #e8eaf0;
          margin-bottom: 6px;
        }

        .reg-title span {
          background: linear-gradient(135deg, #4ade80, #86efac);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .reg-subtitle {
          font-size: 13px;
          color: #475569;
          margin-bottom: 24px;
          font-weight: 400;
        }

        .reg-steps {
          display: flex;
          gap: 6px;
          margin-bottom: 24px;
        }

        .reg-step {
          flex: 1;
          height: 3px;
          border-radius: 100px;
          background: rgba(255,255,255,0.07);
          transition: background 0.4s ease;
        }
        .reg-step.done   { background: rgba(34,197,94,0.5); }
        .reg-step.active { background: #22c55e; }

        .reg-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }

        .reg-field { display: flex; flex-direction: column; gap: 7px; }

        .reg-field label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #475569;
        }

        .reg-field-wrap { position: relative; }

        .reg-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 10px;
          padding: 11px 14px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #e8eaf0;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }

        .reg-input::placeholder { color: #334155; }

        .reg-input:focus {
          border-color: rgba(34,197,94,0.45);
          background: rgba(34,197,94,0.03);
          box-shadow: 0 0 0 3px rgba(34,197,94,0.07);
        }

        .reg-input option { background: #0f1318; color: #e8eaf0; }

        .pass-toggle {
          position: absolute;
          right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #475569;
          cursor: pointer;
          font-size: 16px;
          padding: 4px;
          transition: color 0.2s;
          line-height: 1;
        }
        .pass-toggle:hover { color: #94a3b8; }

        .reg-full { margin-bottom: 12px; }

        .reg-section-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #334155;
          margin: 16px 0 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .reg-section-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.06);
        }

        .btn-register {
          width: 100%;
          padding: 14px;
          margin-top: 8px;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.18s, box-shadow 0.18s;
          box-shadow: 0 4px 16px rgba(34,197,94,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn-register:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(34,197,94,0.35);
        }
        .btn-register:disabled { opacity: 0.55; cursor: not-allowed; }

        .reg-spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: regSpin 0.7s linear infinite;
          flex-shrink: 0;
        }

        .reg-footer {
          margin-top: 22px;
          text-align: center;
          font-size: 13px;
          color: #475569;
        }

        .reg-footer button {
          background: none;
          border: none;
          color: #fb923c;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s;
          padding: 0;
        }
        .reg-footer button:hover { color: #fbbf24; }

        @keyframes regOverlayIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes regPanelIn {
          from { opacity: 0; transform: scale(0.92) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes regSpin  { to { transform: rotate(360deg); } }
        @keyframes regPulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%     { opacity:0.4; transform:scale(0.8); }
        }

        @media (max-width: 600px) {
          .reg-panel { padding: 36px 28px 32px; border-radius: 16px; }
          .reg-title { font-size: 34px; }
        }

        @media (max-width: 480px) {
          .reg-overlay { padding: 12px; align-items: flex-end; }
          .reg-panel { padding: 32px 20px 28px; border-radius: 20px 20px 12px 12px; max-width: 100%; }
          .reg-grid { grid-template-columns: 1fr; gap: 10px; }
          .reg-title { font-size: 30px; }
          .reg-input { font-size: 16px; padding: 12px 14px; }
          .reg-subtitle { font-size: 12px; margin-bottom: 20px; }
          .reg-eyebrow  { font-size: 9px; padding: 4px 10px; }
          .reg-footer   { font-size: 12px; }
          .btn-register { padding: 14px; font-size: 14px; }
        }

        @media (max-width: 360px) {
          .reg-panel { padding: 28px 16px 24px; }
          .reg-title { font-size: 26px; }
        }
      `}</style>

      <div className="reg-overlay" onClick={handleOverlayClick}>
        <div className="reg-panel" role="dialog" aria-modal="true" aria-label="Register">

          <button className="reg-close" onClick={onClose} aria-label="Close">✕</button>

          <div className="reg-eyebrow">
            <span className="reg-eyebrow-dot" />
            New Partner
          </div>

          <h2 className="reg-title">
            Join the<br /><span>Network</span>
          </h2>
          <p className="reg-subtitle">Create your food delivery partner account</p>

          <div className="reg-steps">
            {[fullName, partnerId, email, platform, age, zone, vehicleType, password].map((val, i) => (
              <div
                key={i}
                className={`reg-step ${val ? "done" : i === filledCount ? "active" : ""}`}
              />
            ))}
          </div>

          {/* Row 1: Name + Partner ID */}
          <div className="reg-grid">
            <div className="reg-field">
              <label htmlFor="reg-fullname">Full Name</label>
              <input
                id="reg-fullname"
                className="reg-input"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="reg-field">
              <label htmlFor="reg-partnerid">Partner ID</label>
              <input
                id="reg-partnerid"
                className="reg-input"
                placeholder="e.g. ZOM-00123"
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
              />
            </div>

            {/* Row 2: Platform + Age */}
            <div className="reg-field">
              <label htmlFor="reg-platform">Platform</label>
              <select
                id="reg-platform"
                className="reg-input"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                style={{ cursor: "pointer" }}
              >
                <option value="" disabled>Select platform</option>
                {/* values are lowercase — matches backend + PLATFORM_META */}
                <option value="zomato">Zomato</option>
                <option value="swiggy">Swiggy</option>
                <option value="both">Both (Zomato + Swiggy)</option>
                <option value="zepto">Zepto</option>
                <option value="blinkit">Blinkit</option>
                <option value="dunzo">Dunzo</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="reg-field">
              <label htmlFor="reg-age">Age</label>
              <input
                id="reg-age"
                type="number"
                min={18}
                max={65}
                className="reg-input"
                placeholder="e.g. 25"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
          </div>

          <div className="reg-section-label">Delivery Details</div>

          {/* Row 3: Zone + Vehicle Type */}
          <div className="reg-grid" style={{ marginBottom: "12px" }}>
            <div className="reg-field">
              <label htmlFor="reg-zone">Zone (Chennai)</label>
              <select
                id="reg-zone"
                className="reg-input"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                style={{ cursor: "pointer" }}
              >
                <option value="" disabled>Select zone</option>
                <option value="velachery">Velachery</option>
                <option value="adyar">Adyar</option>
                <option value="porur">Porur</option>
                <option value="tambaram">Tambaram</option>
                <option value="chromepet">Chromepet</option>
                <option value="kodambakkam">Kodambakkam</option>
                <option value="perambur">Perambur</option>
                <option value="t_nagar">T. Nagar</option>
                <option value="anna_nagar">Anna Nagar</option>
                <option value="guindy">Guindy</option>
                <option value="omr">OMR</option>
              </select>
            </div>

            <div className="reg-field">
              <label htmlFor="reg-vehicle">Vehicle Type</label>
              <select
                id="reg-vehicle"
                className="reg-input"
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                style={{ cursor: "pointer" }}
              >
                <option value="" disabled>Select vehicle</option>
                <option value="two_wheeler">Two Wheeler</option>
                <option value="bicycle">Bicycle</option>
                <option value="ev_scooter">EV Scooter</option>
              </select>
            </div>
          </div>

          {/* Email — full width */}
          <div className="reg-field reg-full">
            <label htmlFor="reg-email">Email Address</label>
            <input
              id="reg-email"
              type="email"
              className="reg-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Password — full width */}
          <div className="reg-field reg-full">
            <label htmlFor="reg-password">Password</label>
            <div className="reg-field-wrap">
              <input
                id="reg-password"
                type={showPass ? "text" : "password"}
                className="reg-input"
                placeholder="••••••••"
                style={{ paddingRight: "44px" }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && register()}
              />
              <button
                className="pass-toggle"
                onClick={() => setShowPass((v) => !v)}
                type="button"
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <button className="btn-register" onClick={register} disabled={loading}>
            {loading && <span className="reg-spinner" />}
            {loading ? "Registering..." : "Create Account →"}
          </button>

          {onSwitchToLogin && (
            <div className="reg-footer">
              Already have an account?{" "}
              <button onClick={onSwitchToLogin}>Login here</button>
            </div>
          )}

        </div>
      </div>
    </>
  )
}