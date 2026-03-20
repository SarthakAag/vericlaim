"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import API from "@/services/api";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  const login = async () => {
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    try {
      setLoading(true);
      setError("");

      const formData = new URLSearchParams();
      formData.append("username", email); // OAuth2PasswordRequestForm requires "username" key
      formData.append("password", password);

      const res = await API.post("/admin/login", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      localStorage.setItem("admin_token", res.data.access_token);
      router.push("/admin/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

        .admin-page {
          min-height: 100vh;
          background: #05070a;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: 'DM Sans', sans-serif;
        }

        .admin-card {
          position: relative;
          width: 100%;
          max-width: 420px;
          background: #0f1318;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 48px 40px 40px;
          box-shadow:
            0 0 0 1px rgba(239,68,68,0.06),
            0 32px 80px rgba(0,0,0,0.6),
            0 0 60px rgba(239,68,68,0.04);
        }

        .admin-card::before {
          content: '';
          position: absolute;
          top: 0; left: 10%; right: 10%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #ef4444, transparent);
          border-radius: 0 0 4px 4px;
        }

        .admin-badge {
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
          margin-bottom: 20px;
        }

        .badge-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #ef4444;
          animation: pulse 2s ease-in-out infinite;
        }

        .admin-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 42px;
          letter-spacing: 0.03em;
          line-height: 1;
          color: #e8eaf0;
          margin-bottom: 6px;
        }

        .admin-title span {
          background: linear-gradient(135deg, #ef4444, #f97316);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .admin-subtitle {
          font-size: 13px;
          color: #475569;
          margin-bottom: 32px;
        }

        .error-box {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px;
          padding: 10px 14px;
          color: #f87171;
          font-size: 13px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .field { margin-bottom: 16px; }

        .field label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #475569;
          margin-bottom: 8px;
        }

        .field-wrap { position: relative; }

        .field-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 10px;
          padding: 12px 16px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #e8eaf0;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }

        .field-input::placeholder { color: #334155; }

        .field-input:focus {
          border-color: rgba(239,68,68,0.5);
          background: rgba(239,68,68,0.04);
          box-shadow: 0 0 0 3px rgba(239,68,68,0.08);
        }

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
        }
        .pass-toggle:hover { color: #94a3b8; }

        .btn-admin {
          width: 100%;
          padding: 14px;
          margin-top: 8px;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.18s, box-shadow 0.18s;
          box-shadow: 0 4px 16px rgba(239,68,68,0.3);
        }

        .btn-admin:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(239,68,68,0.4);
        }

        .btn-admin:disabled { opacity: 0.55; cursor: not-allowed; }

        .btn-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        .back-link {
          margin-top: 24px;
          text-align: center;
          font-size: 13px;
          color: #475569;
        }

        .back-link a {
          color: #ef4444;
          font-weight: 600;
          text-decoration: none;
          transition: color 0.2s;
        }
        .back-link a:hover { color: #f97316; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 480px) {
          .admin-page {
            padding: 16px;
            align-items: flex-end;
          }

          .admin-card {
            border-radius: 20px 20px 16px 16px;
            padding: 36px 20px 28px;
            max-height: 92vh;
            overflow-y: auto;
          }

          .admin-title {
            font-size: 34px;
          }

          .admin-subtitle {
            font-size: 12px;
            margin-bottom: 24px;
          }

          .field-input {
            font-size: 16px;
            padding: 13px 14px;
          }

          .btn-admin {
            padding: 15px;
            font-size: 15px;
          }
        }

        @media (max-width: 360px) {
          .admin-card {
            padding: 32px 16px 24px;
          }

          .admin-title {
            font-size: 30px;
          }
        }
      `}</style>

      <div className="admin-page">
        <div className="admin-card">

          <div className="admin-badge">
            <span className="badge-dot" />
            Admin Portal
          </div>

          <h1 className="admin-title">
            Admin<br /><span>Access</span>
          </h1>
          <p className="admin-subtitle">Sign in to manage the insurance platform</p>

          {/* Error box */}
          {error && (
            <div className="error-box">
              ⚠ {error}
            </div>
          )}

          {/* Email field */}
          <div className="field">
            <label htmlFor="admin-email">Email</label>
            <div className="field-wrap">
              <input
                id="admin-email"
                type="email"
                className="field-input"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && login()}
              />
            </div>
          </div>

          {/* Password field */}
          <div className="field">
            <label htmlFor="admin-password">Password</label>
            <div className="field-wrap">
              <input
                id="admin-password"
                type={showPass ? "text" : "password"}
                className="field-input"
                placeholder="••••••••"
                style={{ paddingRight: "44px" }}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && login()}
              />
              <button
                className="pass-toggle"
                onClick={() => setShowPass(v => !v)}
                type="button"
              >
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <button className="btn-admin" onClick={login} disabled={loading}>
            <div className="btn-inner">
              {loading && <span className="spinner" />}
              {loading ? "Signing in..." : "Sign In →"}
            </div>
          </button>

          <div className="back-link">
            Not an admin? <a href="/">Go back home</a>
          </div>

        </div>
      </div>
    </>
  );
}