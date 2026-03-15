"use client";

import { useEffect, useState } from "react";
import API from "@/services/api";

interface Policy {
  id: number;
  policy_name: string;
  coverage_amount: number;
  weekly_premium: number;
}

export default function EnrollPolicy() {

  const [policies, setPolicies] = useState<Policy[]>([]);

  // Fetch policies from backend
  useEffect(() => {
    const fetchPolicies = async () => {
      const res = await API.get("/policy/all");
      setPolicies(res.data);
    };

    fetchPolicies();
  }, []);

  const enroll = async (policyId: number) => {

    const token = localStorage.getItem("user_token");

    await API.post(
      "/enrollment/enroll",
      {
        policy_id: policyId
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    alert("Policy Enrolled Successfully");
  };

  return (
    <div className="p-10">

      <h1 className="text-2xl font-bold mb-6">
        Available Insurance Policies
      </h1>

      {policies.map((policy) => (
        <div
          key={policy.id}
          className="border p-5 mb-4 rounded shadow"
        >
          <h2 className="text-xl font-semibold">
            {policy.policy_name}
          </h2>

          <p>Coverage: ₹{policy.coverage_amount}</p>
          <p>Weekly Premium: ₹{policy.weekly_premium}</p>

          <button
            onClick={() => enroll(policy.id)}
            className="mt-3 bg-green-500 text-white px-4 py-2 rounded"
          >
            Enroll
          </button>
        </div>
      ))}

    </div>
  );
}