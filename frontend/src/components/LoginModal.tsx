"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import API from "@/services/api"

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchToRegister?: () => void
}

export default function LoginModal({ isOpen, onClose, onSwitchToRegister }: LoginModalProps) {

  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem("user_token")
    if (token) router.push("/earnings")
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    if (isOpen) document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [isOpen])

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [isOpen])

  const login = async () => {
    if (!email || !password) {
      alert("Please enter email and password")
      return
    }
    try {
      setLoading(true)
      const res = await API.post("/auth/login", { email, password })

      localStorage.setItem("user_token", res.data.access_token)

      // ── Sync platform + zone so Navbar badge and earnings page are instant ──
      if (res.data.platform) localStorage.setItem("user_platform", res.data.platform)
      if (res.data.zone)     localStorage.setItem("user_zone",     res.data.zone)   // ← ADDED
      // ────────────────────────────────────────────────────────────────────────

      router.push("/enroll-policy")
    } catch (err: any) {
      console.error(err)
      alert(err?.response?.data?.detail || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

        .modal-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(5,7,10,0.85); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: 16px; animation: overlayIn 0.2s ease both;
        }
        .modal-panel {
          position: relative; width: 100%; max-width: 420px;
          background: #0f1318; border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px; padding: 44px 40px 40px;
          box-shadow: 0 0 0 1px rgba(251,146,60,0.08), 0 32px 80px rgba(0,0,0,0.6), 0 0 60px rgba(249,115,22,0.06);
          animation: panelIn 0.3s cubic-bezier(0.34,1.4,0.64,1) both;
          font-family: 'DM Sans', sans-serif;
          max-height: calc(100vh - 32px); overflow-y: auto;
        }
        .modal-panel::before {
          content: ''; position: absolute; top: 0; left: 10%; right: 10%;
          height: 2px; background: linear-gradient(90deg,transparent,#f97316,transparent);
          border-radius: 0 0 4px 4px;
        }
        .modal-close {
          position: absolute; top: 16px; right: 16px;
          width: 32px; height: 32px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04);
          color: #64748b; font-size: 16px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.2s, color 0.2s;
        }
        .modal-close:hover { background: rgba(255,255,255,0.1); color: #e8eaf0; }
        .modal-eyebrow {
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(251,146,60,0.1); border: 1px solid rgba(251,146,60,0.25);
          color: #fb923c; font-size: 10px; font-weight: 600; letter-spacing: 0.14em;
          text-transform: uppercase; padding: 5px 12px; border-radius: 100px; margin-bottom: 20px;
        }
        .eyebrow-dot {
          width: 5px; height: 5px; border-radius: 50%; background: #fb923c;
          animation: pulse 2s ease-in-out infinite;
        }
        .modal-title {
          font-family: 'Bebas Neue', sans-serif; font-size: 42px;
          letter-spacing: 0.03em; line-height: 1; color: #e8eaf0; margin-bottom: 6px;
        }
        .modal-title span {
          background: linear-gradient(135deg,#fb923c,#fbbf24);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .modal-subtitle { font-size: 13px; color: #475569; margin-bottom: 32px; font-weight: 400; }
        .field { margin-bottom: 16px; }
        .field label {
          display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
          text-transform: uppercase; color: #475569; margin-bottom: 8px;
        }
        .field-wrap { position: relative; }
        .field-input {
          width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
          border-radius: 10px; padding: 12px 16px; font-family: 'DM Sans', sans-serif;
          font-size: 14px; color: #e8eaf0; outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s; box-sizing: border-box;
        }
        .field-input::placeholder { color: #334155; }
        .field-input:focus {
          border-color: rgba(249,115,22,0.5); background: rgba(249,115,22,0.04);
          box-shadow: 0 0 0 3px rgba(249,115,22,0.08);
        }
        .pass-toggle {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: #475569; cursor: pointer;
          font-size: 16px; padding: 4px; transition: color 0.2s;
        }
        .pass-toggle:hover { color: #94a3b8; }
        .btn-login {
          width: 100%; padding: 14px; margin-top: 8px; border: none; border-radius: 10px;
          background: linear-gradient(135deg,#f97316,#ea580c); color: #fff;
          font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600;
          letter-spacing: 0.04em; cursor: pointer;
          transition: opacity 0.2s, transform 0.18s, box-shadow 0.18s;
          box-shadow: 0 4px 16px rgba(249,115,22,0.3);
        }
        .btn-login:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(249,115,22,0.4); }
        .btn-login:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-login-inner { display: flex; align-items: center; justify-content: center; gap: 8px; }
        .spinner {
          width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
        }
        .modal-footer { margin-top: 24px; text-align: center; font-size: 13px; color: #475569; }
        .modal-footer button {
          background: none; border: none; color: #fb923c;
          font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: color 0.2s; padding: 0;
        }
        .modal-footer button:hover { color: #fbbf24; }

        @keyframes overlayIn { from{opacity:0} to{opacity:1} }
        @keyframes panelIn {
          from{opacity:0;transform:scale(0.92) translateY(16px)}
          to{opacity:1;transform:scale(1) translateY(0)}
        }
        @keyframes spin  { to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }

        @media (max-width: 480px) {
          .modal-overlay { padding: 12px; align-items: flex-end; }
          .modal-panel { border-radius: 20px 20px 16px 16px; padding: 36px 20px 28px; max-height: 92vh; }
          .modal-title { font-size: 34px; }
          .modal-subtitle { font-size: 12px; margin-bottom: 24px; }
          .field-input { font-size: 16px; padding: 13px 14px; }
          .btn-login { padding: 15px; font-size: 15px; }
        }
        @media (max-width: 360px) {
          .modal-panel { padding: 32px 16px 24px; }
          .modal-title { font-size: 30px; }
        }
      `}</style>

      <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
        <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Login">

          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>

          <div className="modal-eyebrow">
            <span className="eyebrow-dot" />
            Delivery Partner
          </div>

          <h2 className="modal-title">Welcome<br /><span>Back</span></h2>
          <p className="modal-subtitle">Sign in to access your payout dashboard</p>

          <div className="field">
            <label htmlFor="login-email">Email Address</label>
            <div className="field-wrap">
              <input
                id="login-email"
                className="field-input"
                placeholder="you@example.com"
                type="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="login-password">Password</label>
            <div className="field-wrap">
              <input
                id="login-password"
                type={showPass ? "text" : "password"}
                className="field-input"
                placeholder="••••••••"
                style={{ paddingRight: "44px" }}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && login()}
              />
              <button
                className="pass-toggle"
                onClick={() => setShowPass(v => !v)}
                type="button"
                aria-label={showPass ? "Hide password" : "Show password"}
              >
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <button className="btn-login" onClick={login} disabled={loading}>
            <div className="btn-login-inner">
              {loading && <span className="spinner" />}
              {loading ? "Logging in..." : "Login →"}
            </div>
          </button>

          {onSwitchToRegister && (
            <div className="modal-footer">
              Don't have an account?{" "}
              <button onClick={onSwitchToRegister}>Register here</button>
            </div>
          )}

        </div>
      </div>
    </>
  )
}