"use client";

import { useEffect, useState } from "react";
import API from "@/services/api";

export default function Policies() {

  const [policies, setPolicies] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    const res = await API.get("/policy/all");
    setPolicies(res.data);
  };

  const searchPolicy = async () => {
    const res = await API.get(`/policy/search?name=${search}`);
    setPolicies(res.data);
  };

  const enroll = async (policyName: string) => {

  const token = localStorage.getItem("user_token");

  await API.post(
    "/enrollment/enroll",
    { policy_name: policyName },
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

      <h1 className="text-3xl font-bold mb-6">
        Insurance Policies
      </h1>

      <input
        className="border p-2 mr-3"
        placeholder="Search policy"
        onChange={(e)=>setSearch(e.target.value)}
      />

      <button
        onClick={searchPolicy}
        className="bg-blue-500 text-white px-4 py-2"
      >
        Search
      </button>

      <div className="mt-6">

        {policies.map((p)=>(
          <div key={p.id} className="border p-4 mb-4">

            <h2 className="text-xl font-semibold">
              {p.policy_name}
            </h2>

            <p>Coverage: ₹{p.coverage_amount}</p>
            <p>Weekly Premium: ₹{p.weekly_premium}</p>

            <button
              onClick={()=>enroll(p.policy_name)}
              className="mt-3 bg-green-500 text-white px-4 py-2"
            >
              Enroll
            </button>

          </div>
        ))}

      </div>

    </div>
  );
}