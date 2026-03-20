"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

interface NavbarProps {
  onRegisterClick?: () => void
  onLoginClick?: () => void
}

export default function Navbar({ onRegisterClick, onLoginClick }: NavbarProps = {}) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [scrolled,   setScrolled]   = useState(false)
  const [menuOpen,   setMenuOpen]   = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("user_token")
    if (token) setIsLoggedIn(true)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Close menu on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 768) setMenuOpen(false) }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [menuOpen])

  const logout = () => {
    localStorage.removeItem("user_token")
    window.location.href = "/"
  }

  const close = () => setMenuOpen(false)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

        /* ── BASE ── */
        .navbar {
          position: sticky; top: 0; z-index: 900;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 32px; height: 64px;
          font-family: 'DM Sans', sans-serif;
          background: rgba(10,12,16,0.6);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          transition: background .3s, border-color .3s, box-shadow .3s;
        }
        .navbar.scrolled {
          background: rgba(10,12,16,0.95);
          border-bottom-color: rgba(249,115,22,0.15);
          box-shadow: 0 1px 32px rgba(0,0,0,0.4);
        }

        /* ── BRAND ── */
        .nav-brand {
          display: flex; align-items: center; gap: 10px;
          text-decoration: none; flex-shrink: 0;
        }
        .nav-brand-icon {
          width: 32px; height: 32px;
          background: linear-gradient(135deg,#f97316,#ea580c);
          border-radius: 8px; display: flex; align-items: center;
          justify-content: center; font-size: 16px; flex-shrink: 0;
          box-shadow: 0 0 12px rgba(249,115,22,0.35);
        }
        .nav-brand-text {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 22px; letter-spacing: .05em; color: #e8eaf0; line-height: 1;
        }

        /* ── DESKTOP LINKS ── */
        .nav-links {
          display: flex; align-items: center; gap: 4px;
        }
        .nav-link {
          padding: 6px 14px; border-radius: 8px;
          font-size: 13.5px; font-weight: 500; color: #64748b;
          text-decoration: none; transition: color .2s, background .2s;
          letter-spacing: .01em; white-space: nowrap;
        }
        .nav-link:hover { color: #e8eaf0; background: rgba(255,255,255,.06); }
        .nav-divider { width: 1px; height: 20px; background: rgba(255,255,255,.08); margin: 0 8px; flex-shrink: 0; }

        /* ── BUTTONS ── */
        .nav-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 18px; border-radius: 8px;
          font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
          letter-spacing: .03em; cursor: pointer; text-decoration: none;
          transition: transform .18s, box-shadow .18s, background .18s; border: none;
          white-space: nowrap;
        }
        .nav-btn-primary { background: linear-gradient(135deg,#f97316,#ea580c); color: #fff; box-shadow: 0 2px 10px rgba(249,115,22,.28); }
        .nav-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(249,115,22,.4); }
        .nav-btn-ghost   { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1) !important; color: #94a3b8; }
        .nav-btn-ghost:hover { background: rgba(255,255,255,.09); color: #e8eaf0; }
        .nav-btn-danger  { background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.2) !important; color: #f87171; }
        .nav-btn-danger:hover { background: rgba(239,68,68,.2); color: #fca5a5; }
        .nav-btn-admin {
          background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.22) !important;
          color: #ef4444; font-size: 12px; letter-spacing: .07em; text-transform: uppercase; padding: 6px 14px;
        }
        .nav-btn-admin:hover { background: rgba(239,68,68,.16); color: #f87171; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(239,68,68,.18); }
        .admin-dot { width: 5px; height: 5px; border-radius: 50%; background: #ef4444; animation: adminPulse 2s ease-in-out infinite; flex-shrink: 0; }
        @keyframes adminPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }

        /* ── HAMBURGER ── */
        .nav-hamburger {
          display: none; flex-direction: column; justify-content: center;
          align-items: center; gap: 5px;
          width: 40px; height: 40px; cursor: pointer;
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
          border-radius: 8px; flex-shrink: 0;
        }
        .ham-bar {
          width: 18px; height: 2px; background: #94a3b8;
          border-radius: 1px; transition: all .25s;
        }
        .nav-hamburger.open .ham-bar:nth-child(1) { transform: translateY(7px) rotate(45deg); }
        .nav-hamburger.open .ham-bar:nth-child(2) { opacity: 0; transform: scaleX(0); }
        .nav-hamburger.open .ham-bar:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

        /* ── MOBILE DRAWER ── */
        .nav-drawer {
          display: none;
          position: fixed; inset: 64px 0 0 0; z-index: 800;
          background: rgba(10,12,16,.98);
          backdrop-filter: blur(20px);
          flex-direction: column;
          padding: 24px 20px;
          gap: 6px;
          overflow-y: auto;
          border-top: 1px solid rgba(255,255,255,.07);
          animation: drawerIn .2s ease both;
        }
        .nav-drawer.open { display: flex; }
        @keyframes drawerIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }

        .drawer-link {
          display: flex; align-items: center;
          padding: 14px 16px; border-radius: 10px;
          font-size: 15px; font-weight: 500; color: #94a3b8;
          text-decoration: none; transition: all .2s;
          border: 1px solid transparent;
        }
        .drawer-link:hover { background: rgba(255,255,255,.05); color: #e8eaf0; border-color: rgba(255,255,255,.09); }

        .drawer-divider { height: 1px; background: rgba(255,255,255,.07); margin: 8px 0; }

        .drawer-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 14px 20px; border-radius: 10px;
          font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600;
          cursor: pointer; border: none; transition: all .2s; text-decoration: none;
        }
        .drawer-btn-primary { background: linear-gradient(135deg,#f97316,#ea580c); color: #fff; box-shadow: 0 4px 16px rgba(249,115,22,.28); }
        .drawer-btn-primary:hover { box-shadow: 0 6px 22px rgba(249,115,22,.4); }
        .drawer-btn-ghost { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12) !important; color: #94a3b8; }
        .drawer-btn-danger { background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.25) !important; color: #f87171; }
        .drawer-btn-admin  { background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.22) !important; color: #ef4444; }

        .drawer-section-label {
          font-size: 10px; font-weight: 600; letter-spacing: .12em;
          text-transform: uppercase; color: #334155;
          padding: 8px 16px 4px;
        }

        /* ── RESPONSIVE BREAKPOINTS ── */
        @media (max-width: 768px) {
          .navbar { padding: 0 16px; }
          .nav-links { display: none; }
          .nav-hamburger { display: flex; }
          .nav-brand-text { font-size: 19px; }
        }

        @media (max-width: 400px) {
          .nav-brand-text { font-size: 16px; }
          .nav-brand-icon { width: 28px; height: 28px; font-size: 14px; }
        }
      `}</style>

      {/* ── TOP BAR ── */}
      <nav className={`navbar${scrolled ? " scrolled" : ""}`}>

        <Link href="/" className="nav-brand" onClick={close}>
          <div className="nav-brand-icon">🛵</div>
          <span className="nav-brand-text">Gig Insurance</span>
        </Link>

        {/* Desktop links */}
        <div className="nav-links">
          <Link href="/" className="nav-link">Home</Link>

          {!isLoggedIn && (
            <>
              <div className="nav-divider" />
              {onLoginClick
                ? <button onClick={onLoginClick} className="nav-btn nav-btn-ghost">Login</button>
                : <Link href="/user/login" className="nav-btn nav-btn-ghost">Login</Link>
              }
              {onRegisterClick
                ? <button onClick={onRegisterClick} className="nav-btn nav-btn-primary">Register</button>
                : <Link href="/user/register" className="nav-btn nav-btn-primary">Register</Link>
              }
            </>
          )}

          {isLoggedIn && (
            <>
              <Link href="/complete-delivery" className="nav-link">Start Delivery</Link>
              <Link href="/earnings" className="nav-link">Dashboard</Link>
              <div className="nav-divider" />
              <button onClick={logout} className="nav-btn nav-btn-danger">⏻ Logout</button>
            </>
          )}

          <div className="nav-divider" />
          <Link href="/admin/login" className="nav-btn nav-btn-admin">
            <span className="admin-dot" />Admin
          </Link>
        </div>

        {/* Hamburger (mobile only) */}
        <button
          className={`nav-hamburger${menuOpen ? " open" : ""}`}
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Toggle menu"
        >
          <span className="ham-bar" />
          <span className="ham-bar" />
          <span className="ham-bar" />
        </button>
      </nav>

      {/* ── MOBILE DRAWER ── */}
      <div className={`nav-drawer${menuOpen ? " open" : ""}`}>

        <div className="drawer-section-label">Navigation</div>
        <Link href="/" className="drawer-link" onClick={close}>🏠 &nbsp;Home</Link>

        {!isLoggedIn && (
          <>
            <div className="drawer-divider" />
            <div className="drawer-section-label">Account</div>
            {onLoginClick ? (
              <button className="drawer-btn drawer-btn-ghost"
                onClick={() => { onLoginClick(); close() }}>
                Login
              </button>
            ) : (
              <Link href="/user/login" className="drawer-btn drawer-btn-ghost" onClick={close}>
                Login
              </Link>
            )}
            {onRegisterClick ? (
              <button className="drawer-btn drawer-btn-primary"
                onClick={() => { onRegisterClick(); close() }}>
                Register →
              </button>
            ) : (
              <Link href="/user/register" className="drawer-btn drawer-btn-primary" onClick={close}>
                Register →
              </Link>
            )}
          </>
        )}

        {isLoggedIn && (
          <>
            <div className="drawer-divider" />
            <div className="drawer-section-label">Partner Portal</div>
            <Link href="/enroll-policy"     className="drawer-link" onClick={close}>📋 &nbsp;Enroll Policy</Link>
            <Link href="/pay-premium"        className="drawer-link" onClick={close}>💳 &nbsp;Pay Premium</Link>
            <Link href="/policies"           className="drawer-link" onClick={close}>📄 &nbsp;Policies</Link>
            <Link href="/earnings"           className="drawer-link" onClick={close}>💰 &nbsp;Earnings</Link>
            <Link href="/complete-delivery"  className="drawer-link" onClick={close}>🚀 &nbsp;Start Delivery</Link>
            <Link href="/risk-map"           className="drawer-link" onClick={close}>🗺 &nbsp;Risk Map</Link>
            <div className="drawer-divider" />
            <button className="drawer-btn drawer-btn-danger" onClick={() => { logout(); close() }}>
              ⏻ &nbsp;Logout
            </button>
          </>
        )}

        <div className="drawer-divider" />
        <div className="drawer-section-label">Admin</div>
        <Link href="/admin/login" className="drawer-btn drawer-btn-admin" onClick={close}>
          <span className="admin-dot" /> &nbsp;Admin Panel
        </Link>

      </div>
    </>
  )
}