"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import API from "@/services/api"
import Navbar from "@/components/Navbar"

export default function Login(){

  const router = useRouter()

  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")
  const [loading,setLoading] = useState(false)

  // 🔒 Prevent logged-in user from seeing login page
  useEffect(() => {
    const token = localStorage.getItem("user_token")
    if (token) {
      router.push("/earnings")
    }
  }, [])

  const login = async () => {

    if (!email || !password) {
      alert("Please enter email and password")
      return
    }

    try{

      setLoading(true)

      const res = await API.post("/auth/login",{
        email,
        password
      })

      localStorage.setItem("user_token",res.data.access_token)

      router.push("/enroll-policy")

    }catch(err:any){

      console.error(err)

      alert(err?.response?.data?.detail || "Login failed")

    } finally {
      setLoading(false)
    }

  }

  return(

    <div>

      <Navbar/>

      <div className="p-10 max-w-md mx-auto">

        <h1 className="text-2xl font-bold mb-6">
          Delivery Partner Login
        </h1>

        <input
          className="border p-2 mb-3 w-full"
          placeholder="Email"
          onChange={(e)=>setEmail(e.target.value)}
        />

        <input
          type="password"
          className="border p-2 mb-3 w-full"
          placeholder="Password"
          onChange={(e)=>setPassword(e.target.value)}
        />

        <button
          onClick={login}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 w-full"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

      </div>

    </div>

  )
}