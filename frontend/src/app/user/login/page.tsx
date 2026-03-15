"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import API from "@/services/api";

export default function UserLogin() {

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const login = async () => {

    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    try {

      setLoading(true);

      const res = await API.post("/auth/login", {
        email: email,
        password: password
      });

      localStorage.setItem("user_token", res.data.access_token);

      alert("Login Successful");

      // Redirect to earnings dashboard
      router.push("/earnings");

    } catch (error: any) {

      console.error(error);

      if (error.response) {
        alert(error.response.data.detail || "Login failed");
      } else {
        alert("Server error");
      }

    } finally {
      setLoading(false);
    }
  };

  return (

    <div className="p-10 max-w-md mx-auto">

      <h1 className="text-2xl font-bold mb-6">
        Delivery Partner Login
      </h1>

      <input
        className="border p-2 mb-4 block w-full"
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        className="border p-2 mb-4 block w-full"
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={login}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded w-full"
      >
        {loading ? "Logging in..." : "Login"}
      </button>

    </div>
  );
}