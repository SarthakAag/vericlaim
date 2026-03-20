"use client"

import { useState } from "react"
import Navbar from "@/components/Navbar"
import LoginModal from "@/components/LoginModal"
import RegisterModal from "@/components/RegisterModal"

export default function Home() {
  const [loginOpen, setLoginOpen] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)

  const features = [
    {
      icon: "🌧",
      label: "Weather Conditions",
      desc: "Real-time weather data adjusts payout rates dynamically",
    },
    {
      icon: "🚦",
      label: "Traffic Conditions",
      desc: "Live traffic analysis factors into partner compensation",
    },
    {
      icon: "📍",
      label: "Live Location",
      desc: "GPS tracking ensures accurate distance-based payouts",
    },
    {
      icon: "🤖",
      label: "AI Delay Prediction",
      desc: "Machine learning predicts delays before they happen",
    },
  ]

  return (
    <div className="home-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .home-root {
          min-height: 100vh;
          background-color: #0a0c10;
          background-image:
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(251,146,60,0.12) 0%, transparent 70%),
            linear-gradient(180deg, #0a0c10 0%, #0f1318 100%);
          color: #e8eaf0;
          font-family: 'DM Sans', sans-serif;
          overflow-x: hidden;
        }

        /* ── HERO ── */
        .hero {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 100px 24px 80px;
        }

        .hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.03) 39px, rgba(255,255,255,0.03) 40px),
            repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.03) 39px, rgba(255,255,255,0.03) 40px);
          pointer-events: none;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(251,146,60,0.12);
          border: 1px solid rgba(251,146,60,0.3);
          color: #fb923c;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          padding: 6px 16px;
          border-radius: 100px;
          margin-bottom: 32px;
          animation: fadeSlideDown 0.6s ease both;
        }

        .eyebrow-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #fb923c;
          animation: pulse 2s ease-in-out infinite;
          flex-shrink: 0;
        }

        .hero-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(52px, 9vw, 110px);
          line-height: 0.95;
          letter-spacing: 0.02em;
          margin: 0 0 24px;
          animation: fadeSlideUp 0.7s 0.1s ease both;
          word-break: break-word;
        }

        .hero-title span {
          display: block;
          background: linear-gradient(135deg, #fb923c 0%, #f97316 40%, #fbbf24 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-sub {
          max-width: 480px;
          width: 100%;
          font-size: clamp(14px, 2vw, 16px);
          font-weight: 300;
          line-height: 1.7;
          color: #94a3b8;
          margin-bottom: 48px;
          animation: fadeSlideUp 0.7s 0.2s ease both;
        }

        /* ── BUTTONS ── */
        .cta-group {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          justify-content: center;
          animation: fadeSlideUp 0.7s 0.3s ease both;
          width: 100%;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 32px;
          border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.03em;
          text-decoration: none;
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
          cursor: pointer;
          border: none;
          white-space: nowrap;
        }

        .btn-primary {
          background: linear-gradient(135deg, #f97316, #ea580c);
          color: #fff;
          box-shadow: 0 4px 16px rgba(249,115,22,0.3);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 0 4px rgba(249,115,22,0.15), 0 8px 24px rgba(249,115,22,0.4);
        }

        .btn-secondary {
          background: rgba(255,255,255,0.05);
          color: #e8eaf0;
          border: 1px solid rgba(255,255,255,0.12) !important;
          backdrop-filter: blur(8px);
        }

        .btn-secondary:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.22) !important;
          transform: translateY(-2px);
        }

        /* ── STATS ROW ── */
        .stats-row {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 40px;
          flex-wrap: wrap;
          margin-top: 64px;
          max-width: 600px;
          width: 100%;
          animation: fadeSlideUp 0.7s 0.4s ease both;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .stat-val {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(28px, 5vw, 36px);
          letter-spacing: 0.04em;
          color: #fb923c;
          line-height: 1;
        }

        .stat-label {
          font-size: 11px;
          color: #475569;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 600;
          white-space: nowrap;
        }

        .stat-divider {
          width: 1px;
          height: 40px;
          background: rgba(255,255,255,0.08);
        }

        /* ── DIVIDER ── */
        .divider {
          width: 100%;
          max-width: 900px;
          margin: 80px auto;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
        }

        /* ── FEATURES ── */
        .features-section {
          padding: 0 24px 100px;
          max-width: 1100px;
          margin: 0 auto;
        }

        .section-label {
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #475569;
          margin-bottom: 48px;
          animation: fadeSlideUp 0.7s 0.4s ease both;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }

        .feature-card {
          position: relative;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 32px 28px;
          transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s ease;
          animation: fadeSlideUp 0.6s ease both;
          overflow: hidden;
        }

        .feature-card:nth-child(1) { animation-delay: 0.45s; }
        .feature-card:nth-child(2) { animation-delay: 0.55s; }
        .feature-card:nth-child(3) { animation-delay: 0.65s; }
        .feature-card:nth-child(4) { animation-delay: 0.75s; }

        .feature-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at top left, rgba(251,146,60,0.06), transparent 60%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .feature-card:hover {
          border-color: rgba(251,146,60,0.25);
          background: rgba(255,255,255,0.05);
          transform: translateY(-4px);
        }

        .feature-card:hover::before { opacity: 1; }

        .feature-icon {
          font-size: 32px;
          margin-bottom: 16px;
          display: block;
        }

        .feature-label {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px;
          letter-spacing: 0.05em;
          color: #e8eaf0;
          margin-bottom: 10px;
        }

        .feature-desc {
          font-size: 13.5px;
          color: #64748b;
          line-height: 1.65;
          font-weight: 400;
        }

        /* ── HOW IT WORKS ── */
        .how-section {
          max-width: 900px;
          margin: 0 auto 100px;
          padding: 0 24px;
        }

        .how-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(32px, 5vw, 48px);
          letter-spacing: 0.04em;
          text-align: center;
          margin-bottom: 48px;
          color: #e8eaf0;
        }

        .how-title span {
          background: linear-gradient(135deg, #fb923c, #fbbf24);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 14px;
          padding: 28px 20px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
        }

        .step-num {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f97316, #ea580c);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px;
          color: #fff;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(249,115,22,0.3);
        }

        .step-title {
          font-size: 14px;
          font-weight: 600;
          color: #e8eaf0;
        }

        .step-desc {
          font-size: 13px;
          color: #475569;
          line-height: 1.6;
        }

        /* ── BOTTOM BAR ── */
        .bottom-bar {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 24px;
          text-align: center;
          font-size: 12px;
          color: #334155;
          letter-spacing: 0.05em;
        }

        /* ── ANIMATIONS ── */
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.8); }
        }

        /* ══════════════════════════════════════════
           RESPONSIVE BREAKPOINTS
        ══════════════════════════════════════════ */

        /* Tablet landscape */
        @media (max-width: 1024px) {
          .features-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .stats-row { gap: 28px; }
        }

        /* Tablet portrait */
        @media (max-width: 768px) {
          .hero { padding: 80px 20px 60px; }

          .features-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
          }

          .feature-card { padding: 24px 18px; }

          .steps {
            grid-template-columns: 1fr;
            max-width: 380px;
            margin: 0 auto;
            gap: 14px;
          }

          .stat-divider { display: none; }
          .stats-row { gap: 28px; }

          .divider { margin: 56px auto; }
        }

        /* Mobile */
        @media (max-width: 480px) {
          .hero { padding: 72px 16px 48px; }

          .eyebrow {
            font-size: 10px;
            padding: 5px 12px;
            letter-spacing: 0.1em;
          }

          .hero-sub { font-size: 14px; margin-bottom: 36px; }

          .cta-group {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
            max-width: 300px;
          }

          .btn { width: 100%; padding: 14px 20px; }

          .stats-row {
            gap: 20px;
            margin-top: 48px;
          }

          .stat-val { font-size: 26px; }

          .stat-label {
            font-size: 10px;
            letter-spacing: 0.06em;
          }

          .features-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .features-section {
            padding: 0 16px 72px;
          }

          .feature-card { padding: 20px 16px; }
          .feature-label { font-size: 20px; }
          .feature-desc { font-size: 13px; }

          .how-section {
            padding: 0 16px;
            margin-bottom: 72px;
          }

          .step { padding: 22px 16px; }

          .divider { margin: 40px auto; }

          .section-label {
            font-size: 10px;
            margin-bottom: 28px;
          }
        }

        /* Very small screens */
        @media (max-width: 360px) {
          .hero-title { font-size: 38px; }
          .stat-val { font-size: 22px; }
          .cta-group { max-width: 260px; }
        }
      `}</style>

      <Navbar onLoginClick={() => setLoginOpen(true)} onRegisterClick={() => setRegisterOpen(true)} />

      {/* ── HERO ── */}
      <section className="hero">
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          Powered by AI
        </div>

        <h1 className="hero-title">
          Delivery
          <span>Payout System</span>
        </h1>

        <p className="hero-sub">
          A smart system that calculates delivery partner payouts
          in real-time, factoring in every variable that matters.
        </p>

        <div className="cta-group">
          <button className="btn btn-primary" onClick={() => setLoginOpen(true)}>
            Login →
          </button>
          <button className="btn btn-secondary" onClick={() => setRegisterOpen(true)}>
            Create Account
          </button>
        </div>

        <div className="stats-row">
          <div className="stat-item">
            <span className="stat-val">21</span>
            <span className="stat-label">ML Features</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-val">98%</span>
            <span className="stat-label">Accuracy</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-val">&lt;30s</span>
            <span className="stat-label">Payout</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-val">8</span>
            <span className="stat-label">Zones</span>
          </div>
        </div>
      </section>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSwitchToRegister={() => { setLoginOpen(false); setRegisterOpen(true) }}
      />
      <RegisterModal
        isOpen={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSwitchToLogin={() => { setRegisterOpen(false); setLoginOpen(true) }}
      />

      <div className="divider" />

      {/* ── FEATURES ── */}
      <section className="features-section">
        <p className="section-label">What drives the calculation</p>
        <div className="features-grid">
          {features.map((f) => (
            <div className="feature-card" key={f.label}>
              <span className="feature-icon">{f.icon}</span>
              <div className="feature-label">{f.label}</div>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="how-section">
        <h2 className="how-title">How It <span>Works</span></h2>
        <div className="steps">
          {[
            { n: "1", title: "Complete a Delivery", desc: "Log deliveries with distance, location and timing data" },
            { n: "2", title: "AI Analyses Conditions", desc: "ML model scores weather, traffic and zone risk across 21 features" },
            { n: "3", title: "Instant Payout", desc: "Earnings and bonuses calculated and paid within 30 seconds" },
          ].map((s) => (
            <div className="step" key={s.n}>
              <div className="step-num">{s.n}</div>
              <div className="step-title">{s.title}</div>
              <p className="step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="bottom-bar">
        © {new Date().getFullYear()} AI Delivery Payout System
      </div>
    </div>
  )
}