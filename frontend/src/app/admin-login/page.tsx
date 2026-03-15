"use client";

import { useState } from "react";
import API from "@/services/api";

export default function AdminLogin() {

  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const login = async () => {

    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    const res = await API.post("/admin/login", formData);

    localStorage.setItem("admin_token", res.data.access_token);

    alert("Admin Logged In");
  };

  return (
    <div className="p-10">

      <h1 className="text-2xl font-bold mb-5">
        Admin Login
      </h1>

      <input
        className="border p-2 mb-3 block"
        placeholder="Username"
        onChange={(e) => setUsername(e.target.value)}
      />

      <input
        type="password"
        className="border p-2 mb-3 block"
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={login}
        className="bg-blue-500 text-white px-4 py-2"
      >
        Login
      </button>

    </div>
  );
}