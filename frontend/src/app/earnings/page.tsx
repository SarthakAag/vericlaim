"use client";

import { useEffect, useState } from "react";
import API from "@/services/api";

interface EarningsRecord {
  id: number;
  deliveries_completed: number;
  distance_travelled: number;
  weather_bonus: number;
  traffic_bonus: number;
  insurance_bonus: number;
  total_earnings: number;
}

export default function EarningsDashboard() {

  const [totalEarnings, setTotalEarnings] = useState(0);
  const [records, setRecords] = useState<EarningsRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [totalDeliveries, setTotalDeliveries] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [weatherBonus, setWeatherBonus] = useState(0);
  const [trafficBonus, setTrafficBonus] = useState(0);
  const [insuranceBonus, setInsuranceBonus] = useState(0);

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {

    try {

      const token = localStorage.getItem("user_token");

      const totalRes = await API.get("/earnings/total", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const historyRes = await API.get("/earnings/history", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = historyRes.data;

      setTotalEarnings(totalRes.data.total_earnings);
      setRecords(data);

      // calculate totals
      let deliveries = 0;
      let distance = 0;
      let wBonus = 0;
      let tBonus = 0;
      let iBonus = 0;

      data.forEach((r: EarningsRecord) => {
        deliveries += r.deliveries_completed;
        distance += r.distance_travelled;
        wBonus += r.weather_bonus || 0;
        tBonus += r.traffic_bonus || 0;
        iBonus += r.insurance_bonus || 0;
      });

      setTotalDeliveries(deliveries);
      setTotalDistance(distance);
      setWeatherBonus(wBonus);
      setTrafficBonus(tBonus);
      setInsuranceBonus(iBonus);

      setLoading(false);

    } catch (error) {
      console.error(error);
      alert("Failed to load earnings");
    }
  };

  if (loading) {
    return <div className="p-10">Loading earnings...</div>;
  }

  return (

    <div className="p-10">

      <h1 className="text-3xl font-bold mb-8">
        Earnings Dashboard
      </h1>

      {/* DASHBOARD CARDS */}
      <div className="grid grid-cols-3 gap-6 mb-8">

        <div className="bg-green-100 p-5 rounded-lg">
          <h2 className="font-semibold">Total Earnings</h2>
          <p className="text-2xl font-bold">₹{totalEarnings}</p>
        </div>

        <div className="bg-blue-100 p-5 rounded-lg">
          <h2 className="font-semibold">Total Deliveries</h2>
          <p className="text-2xl font-bold">{totalDeliveries}</p>
        </div>

        <div className="bg-purple-100 p-5 rounded-lg">
          <h2 className="font-semibold">Total Distance</h2>
          <p className="text-2xl font-bold">{totalDistance} km</p>
        </div>

        <div className="bg-yellow-100 p-5 rounded-lg">
          <h2 className="font-semibold">Weather Bonus</h2>
          <p className="text-2xl font-bold">₹{weatherBonus}</p>
        </div>

        <div className="bg-orange-100 p-5 rounded-lg">
          <h2 className="font-semibold">Traffic Bonus</h2>
          <p className="text-2xl font-bold">₹{trafficBonus}</p>
        </div>

        <div className="bg-pink-100 p-5 rounded-lg">
          <h2 className="font-semibold">Insurance Protection</h2>
          <p className="text-2xl font-bold">₹{insuranceBonus}</p>
        </div>

      </div>


      {/* DELIVERY HISTORY */}
      <h2 className="text-xl font-semibold mb-4">
        Delivery History
      </h2>

      {records.length === 0 && (
        <p>No deliveries yet</p>
      )}

      {records.map((r) => (

        <div
          key={r.id}
          className="border p-4 mb-4 rounded-lg"
        >

          <p>
            Deliveries: <b>{r.deliveries_completed}</b>
          </p>

          <p>
            Distance: <b>{r.distance_travelled} km</b>
          </p>

          <p>
            Weather Bonus: ₹{r.weather_bonus}
          </p>

          <p>
            Traffic Bonus: ₹{r.traffic_bonus}
          </p>

          <p>
            Insurance Bonus: ₹{r.insurance_bonus}
          </p>

          <p className="text-green-600 font-bold">
            Earned: ₹{r.total_earnings}
          </p>

        </div>

      ))}

    </div>
  );
}