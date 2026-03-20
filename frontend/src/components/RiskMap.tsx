"use client"

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet"
import { useEffect, useState } from "react"
import API from "@/services/api"
import "leaflet/dist/leaflet.css"

type Location = {
  area: string
  lat: number
  lon: number
  weather: string
  traffic: string
  risk: "high" | "medium" | "low"
}

const riskStyle: Record<string, { color: string; label: string }> = {
  critical: { color: "#FF4D6A", label: "Critical" },
  high:   { color: "#FF4D6A", label: "Critical" },
  medium: { color: "#f59e0b", label: "High"     },
  low:    { color: "#22c55e", label: "Low"       },
}

export default function RiskMap() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState("")

  const center: [number, number] = [13.0827, 80.2707]

  useEffect(() => {
    API.get("/risk-map")
      .then((res) => {
        setLocations(res.data)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Risk map error:", err)
        setError("Could not load risk data. Is the backend running?")
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div style={{
      height: 500,
      borderRadius: 16,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#475569",
      fontSize: 14,
      fontFamily: "DM Sans, sans-serif",
    }}>
      Loading risk map...
    </div>
  )

  if (error) return (
    <div style={{
      height: 500,
      borderRadius: 16,
      background: "rgba(239,68,68,0.05)",
      border: "1px solid rgba(239,68,68,0.15)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#f87171",
      fontSize: 14,
      fontFamily: "DM Sans, sans-serif",
      padding: 24,
      textAlign: "center",
    }}>
      {error}
    </div>
  )

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", height: 500 }}>
      <MapContainer
        center={center}
        zoom={11}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />

        {locations.map((loc) => {
          const style = riskStyle[loc.risk] ?? riskStyle.low
          return (
            <CircleMarker
              key={loc.area}
              center={[loc.lat, loc.lon]}
              radius={14}
              pathOptions={{
                color:       style.color,
                fillColor:   style.color,
                fillOpacity: 0.35,
                weight:      2,
              }}
            >
              <Popup>
                <div style={{ fontFamily: "DM Sans, sans-serif", minWidth: 150 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                    {loc.area}
                  </div>
                  <div style={{ color: style.color, fontWeight: 600, marginBottom: 6 }}>
                    {style.label} Risk
                  </div>
                  <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
                    🌦 Weather: {loc.weather}<br />
                    🚦 Traffic: {loc.traffic}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}