"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import API from "@/services/api"
import Navbar from "@/components/Navbar"

export default function Register() {

  const router = useRouter()

  const [name,setName] = useState("")
  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")
  const [loading,setLoading] = useState(false)

  const register = async () => {

    if (!name || !email || !password) {
      alert("Please fill all fields")
      return
    }

    try{

      setLoading(true)

      await API.post("/auth/register",{
        name,
        email,
        password
      })

      alert("Registration successful")

      router.push("/user/login")

    }catch(err:any){

      console.error(err)

      alert(err?.response?.data?.detail || "Registration failed")

    } finally {
      setLoading(false)
    }

  }

  return(

    <div>

      <Navbar/>

      <div className="p-10 max-w-md mx-auto">

        <h1 className="text-2xl font-bold mb-6">
          Register Delivery Partner
        </h1>

        <input
          className="border p-2 mb-3 w-full"
          placeholder="Name"
          onChange={(e)=>setName(e.target.value)}
        />

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
          onClick={register}
          disabled={loading}
          className="bg-green-600 text-white px-4 py-2 w-full"
        >
          {loading ? "Registering..." : "Register"}
        </button>

      </div>

    </div>

  )
}