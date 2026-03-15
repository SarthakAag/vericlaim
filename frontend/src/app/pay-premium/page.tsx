"use client";

import { useState } from "react";
import API from "@/services/api";

export default function PayPremium() {

  const [policyId, setPolicyId] = useState("");
  const [amount, setAmount] = useState("");

  const payPremium = async () => {

    const token = localStorage.getItem("user_token");

    await API.post(
      "/premium/pay",
      {
        policy_id: Number(policyId),
        amount: Number(amount)
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    alert("Premium Paid Successfully");
  };

  return (
    <div className="p-10">

      <h1 className="text-2xl font-bold mb-5">Pay Premium</h1>

      <input
        className="border p-2 mb-3"
        placeholder="Policy ID"
        onChange={(e)=>setPolicyId(e.target.value)}
      />

      <input
        className="border p-2 mb-3"
        placeholder="Amount"
        onChange={(e)=>setAmount(e.target.value)}
      />

      <button
        onClick={payPremium}
        className="bg-purple-500 text-white px-4 py-2"
      >
        Pay Premium
      </button>

    </div>
  );
}