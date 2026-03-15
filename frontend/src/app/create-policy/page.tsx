"use client";

import { useState } from "react";
import API from "@/services/api";

export default function CreatePolicy() {

  const [policyName, setPolicyName] = useState("");
  const [coverage, setCoverage] = useState("");
  const [premium, setPremium] = useState("");
  const [description, setDescription] = useState("");

  const createPolicy = async () => {

    const token = localStorage.getItem("admin_token");

    await API.post(
      "/policy/create",
      {
        policy_name: policyName,
        coverage_amount: Number(coverage),
        weekly_premium: Number(premium),
        description: description
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    alert("Policy Created");
  };

  return (
    <div className="p-10">

      <h1 className="text-2xl font-bold mb-5">
        Create Policy
      </h1>

      <input className="border p-2 mb-3 block" placeholder="Policy Name" onChange={(e)=>setPolicyName(e.target.value)} />

      <input className="border p-2 mb-3 block" placeholder="Coverage Amount" onChange={(e)=>setCoverage(e.target.value)} />

      <input className="border p-2 mb-3 block" placeholder="Weekly Premium" onChange={(e)=>setPremium(e.target.value)} />

      <input className="border p-2 mb-3 block" placeholder="Description" onChange={(e)=>setDescription(e.target.value)} />

      <button
        onClick={createPolicy}
        className="bg-green-500 text-white px-4 py-2"
      >
        Create Policy
      </button>

    </div>
  );
}