"use client"

import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import Navbar from "@/components/Navbar"

const RiskMap = dynamic(() => import("@/components/RiskMap"), { ssr: false })

const ZONES = [
  { zone: "Velachery",      risk: 90, level: "Critical", color: "#FF4D6A" },
  { zone: "Adyar",          risk: 85, level: "Critical", color: "#FF4D6A" },
  { zone: "Sholinganallur", risk: 78, level: "High",     color: "#f59e0b" },
  { zone: "Porur",          risk: 75, level: "High",     color: "#f59e0b" },
  { zone: "Tambaram",       risk: 70, level: "High",     color: "#f59e0b" },
  { zone: "Pallikaranai",   risk: 72, level: "High",     color: "#f59e0b" },
  { zone: "Kodambakkam",    risk: 65, level: "Medium",   color: "#fb923c" },
  { zone: "T. Nagar",       risk: 50, level: "Medium",   color: "#fb923c" },
  { zone: "Perambur",       risk: 55, level: "Medium",   color: "#fb923c" },
  { zone: "Guindy",         risk: 44, level: "Low",      color: "#22c55e" },
  { zone: "Anna Nagar",     risk: 40, level: "Low",      color: "#22c55e" },
  { zone: "Nungambakkam",   risk: 42, level: "Low",      color: "#22c55e" },
]

export default function RiskMapPage() {
  const router = useRouter()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

        .rm-root {
          min-height: 100vh;
          background-color: #0a0c10;
          background-image:
            radial-gradient(ellipse 80% 45% at 50% -5%, rgba(255,77,106,.06) 0%, transparent 70%),
            linear-gradient(180deg,#0a0c10 0%,#0f1318 100%);
          color: #e8eaf0; font-family: 'DM Sans',sans-serif;
        }

        .rm-inner { max-width: 1100px; margin: 0 auto; padding: 52px 24px 80px; }

        .rm-flow { display:flex;align-items:center;gap:0;margin-bottom:48px;overflow-x:auto; }
        .rm-flow-step { display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#334155;white-space:nowrap; }
        .rm-flow-step.done{color:#22c55e;} .rm-flow-step.active{color:#fb923c;}
        .rm-flow-num { width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700; }
        .rm-flow-step.done .rm-flow-num{background:#22c55e;border-color:#22c55e;color:#0a0c10;}
        .rm-flow-step.active .rm-flow-num{background:#f97316;border-color:#f97316;color:#fff;}
        .rm-flow-arrow { width:22px;height:1px;background:rgba(255,255,255,.1);margin:0 6px;flex-shrink:0; }

        .rm-top { display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:32px;gap:20px;flex-wrap:wrap; }
        .rm-eyebrow { font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#475569;margin-bottom:8px; }
        .rm-title { font-family:'Bebas Neue',sans-serif;font-size:clamp(42px,6vw,68px);letter-spacing:.04em;line-height:.95; }
        .rm-title span { background:linear-gradient(135deg,#FF4D6A,#fb923c);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
        .rm-sub { font-size:14px;color:#475569;margin-top:8px; }

        /* Legend */
        .rm-legend { display:flex;gap:14px;flex-wrap:wrap; }
        .rm-leg { display:flex;align-items:center;gap:6px;font-size:12px;color:#475569; }
        .rm-leg-dot { width:8px;height:8px;border-radius:50%; }

        /* Info strip */
        .rm-strip { display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px; }
        .rm-strip-card { background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:16px 18px;animation:rmFadeUp .5s ease both; }
        .rm-strip-card:nth-child(1){animation-delay:.05s}.rm-strip-card:nth-child(2){animation-delay:.1s}
        .rm-strip-card:nth-child(3){animation-delay:.15s}.rm-strip-card:nth-child(4){animation-delay:.2s}
        .rm-strip-val { font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:.04em;line-height:1;margin-bottom:4px; }
        .rm-strip-key { font-size:11px;color:#475569; }

        /* Layout */
        .rm-layout { display:grid;grid-template-columns:1fr 300px;gap:20px; }
        .rm-sidebar { display:flex;flex-direction:column;gap:8px;max-height:560px;overflow-y:auto; }
        .rm-sidebar::-webkit-scrollbar{width:4px} .rm-sidebar::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
        .rm-sidebar-label { font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#475569;margin-bottom:4px; }

        .rm-zone { background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:11px;padding:13px 14px;transition:all .2s; }
        .rm-zone:hover { background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.13); }
        .rm-zone-top { display:flex;justify-content:space-between;align-items:center;margin-bottom:7px; }
        .rm-zone-name { font-size:14px;font-weight:500;color:#e8eaf0; }
        .rm-zone-badge { font-size:11px;font-weight:600;padding:3px 8px;border-radius:4px; }
        .rm-zone-bar { height:3px;background:rgba(255,255,255,.06);border-radius:2px; }
        .rm-zone-fill { height:100%;border-radius:2px;transition:width .6s ease; }
        .rm-zone-pct { font-size:11px;color:#334155;margin-top:4px; }

        /* COMPLETED BANNER */
        .rm-complete { background:linear-gradient(135deg,rgba(34,197,94,.08),rgba(249,115,22,.06));border:1px solid rgba(34,197,94,.22);border-radius:16px;padding:28px 32px;margin-top:36px;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;animation:rmFadeUp .5s ease both; }
        .rm-complete-title { font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:.04em;color:#4ade80;margin-bottom:4px; }
        .rm-complete-sub { font-size:13px;color:#475569; }

        .rm-done-btn { padding:14px 32px;border-radius:10px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(249,115,22,.28);transition:all .2s;white-space:nowrap; }
        .rm-done-btn:hover { transform:translateY(-2px);box-shadow:0 8px 28px rgba(249,115,22,.4); }

        @keyframes rmFadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @media(max-width:860px){ .rm-layout{grid-template-columns:1fr;} .rm-strip{grid-template-columns:1fr 1fr;} }
        @media(max-width:460px){ .rm-strip{grid-template-columns:1fr;} }
      `}</style>

      <div className="rm-root">
        <Navbar />
        <div className="rm-inner">

          {/* Flow */}
          <div className="rm-flow">
            {[
              { n:"✓",l:"Login",   s:"done"  },{ n:"✓",l:"Enroll",  s:"done"  },
              { n:"✓",l:"Pay",     s:"done"  },{ n:"✓",l:"Policies",s:"done"  },
              { n:"✓",l:"Earnings",s:"done"  },{ n:"✓",l:"Delivery", s:"done"  },
              { n:"7",l:"Risk Map",s:"active"},
            ].map((step, i, arr) => (
              <div key={step.l} style={{ display:"flex", alignItems:"center" }}>
                <div className={`rm-flow-step${step.s ? ` ${step.s}` : ""}`}>
                  <div className="rm-flow-num">{step.n}</div>{step.l}
                </div>
                {i < arr.length - 1 && <div className="rm-flow-arrow" />}
              </div>
            ))}
          </div>

          <div className="rm-top">
            <div>
              <p className="rm-eyebrow">Step 7 of 7 — Final Step</p>
              <h1 className="rm-title">Delivery<br /><span>Risk Map</span></h1>
              <p className="rm-sub">Live flood-risk zones across Chennai. Click circles for details.</p>
            </div>
            <div className="rm-legend">
              {[["#FF4D6A","Critical"],["#f59e0b","High"],["#fb923c","Medium"],["#22c55e","Low"]].map(([c,l]) => (
                <div key={l} className="rm-leg">
                  <div className="rm-leg-dot" style={{ background: c }} />{l}
                </div>
              ))}
            </div>
          </div>

          {/* Stats strip */}
          <div className="rm-strip">
            <div className="rm-strip-card">
              <div className="rm-strip-val" style={{ color:"#FF4D6A" }}>2</div>
              <div className="rm-strip-key">Critical zones</div>
            </div>
            <div className="rm-strip-card">
              <div className="rm-strip-val" style={{ color:"#f97316" }}>17</div>
              <div className="rm-strip-key">Zones monitored</div>
            </div>
            <div className="rm-strip-card">
              <div className="rm-strip-val" style={{ color:"#22c55e" }}>Live</div>
              <div className="rm-strip-key">AI monitoring</div>
            </div>
            <div className="rm-strip-card">
              <div className="rm-strip-val" style={{ color:"#e8eaf0" }}>&lt;30s</div>
              <div className="rm-strip-key">Payout trigger</div>
            </div>
          </div>

          {/* Map + sidebar */}
          <div className="rm-layout">
            <RiskMap />

            <div className="rm-sidebar">
              <div className="rm-sidebar-label">Zone Risk Index</div>
              {ZONES.map((z) => (
                <div key={z.zone} className="rm-zone">
                  <div className="rm-zone-top">
                    <span className="rm-zone-name">{z.zone}</span>
                    <span className="rm-zone-badge"
                      style={{ background: `${z.color}20`, color: z.color }}>{z.level}</span>
                  </div>
                  <div className="rm-zone-bar">
                    <div className="rm-zone-fill" style={{ width: `${z.risk}%`, background: z.color }} />
                  </div>
                  <div className="rm-zone-pct">{z.risk}% flood risk</div>
                </div>
              ))}
            </div>
          </div>

          {/* 🎉 Flow complete banner */}
          <div className="rm-complete">
           
            <button className="rm-done-btn" onClick={() => router.push("/earnings")}>
              Back to Dashboard →
            </button>
          </div>

        </div>
      </div>
    </>
  )
}