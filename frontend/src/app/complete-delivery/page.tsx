"use client";

import { useState } from "react";
import API from "@/services/api";

export default function CompleteDelivery() {

  const [deliveries, setDeliveries] = useState(0);
  const [distance, setDistance] = useState(0);

  const [result, setResult] = useState<any>(null);

  const submitDelivery = () => {

    const token = localStorage.getItem("user_token");

    if (!token) {
      alert("Login first");
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      try {

        const res = await API.post(
          "/earnings/complete-delivery",
          null,
          {
            params: {
              deliveries: deliveries,
              distance_km: distance,
              lat: lat,
              lon: lon,
              late_delivery: false
            },
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        setResult(res.data);

      } catch (err) {
        console.error(err);
        alert("Delivery API failed");
      }

    });

  };

  return (
    <div className="p-10">

      <h1 className="text-3xl font-bold mb-6">
        Test Delivery Earnings
      </h1>

      <input
        type="number"
        placeholder="Deliveries"
        className="border p-2 mb-3 block"
        onChange={(e)=>setDeliveries(Number(e.target.value))}
      />

      <input
        type="number"
        placeholder="Distance (km)"
        className="border p-2 mb-3 block"
        onChange={(e)=>setDistance(Number(e.target.value))}
      />

      <button
        onClick={submitDelivery}
        className="bg-green-600 text-white px-4 py-2"
      >
        Complete Delivery
      </button>


      {result && (
        <div className="mt-6 border p-4 rounded">

          <h2 className="text-xl font-semibold mb-3">
            Delivery Result
          </h2>

          <p>Weather: {result.weather}</p>
          <p>Traffic: {result.traffic}</p>

          <p>Base Earnings: ₹{result.base_earnings}</p>

          <p>Weather Bonus: ₹{result.weather_bonus}</p>
          <p>Traffic Bonus: ₹{result.traffic_bonus}</p>

          <p>Late Penalty: ₹{result.late_penalty}</p>

          <p className="font-bold text-green-600">
            Final Earnings: ₹{result.final_total_earnings}
          </p>

        </div>
      )}

    </div>
  );
}