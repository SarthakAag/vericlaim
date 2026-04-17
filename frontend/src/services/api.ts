import axios from "axios"

const API = axios.create({
  baseURL: "http://127.0.0.1:8000"
})

// 🔐 Token Interceptor (FIXED)
API.interceptors.request.use((config) => {
  const url = config.url || ""

  // ✅ Define ALL admin-protected routes
  const isAdminRoute =
    url.startsWith("/admin") ||
    url.startsWith("/triggers") ||
    url.startsWith("/renewals") ||   // 🔥 ADD THIS
    url.startsWith("/policy")        // 🔥 (optional, since you protect policy/create)

  const token = isAdminRoute
    ? localStorage.getItem("admin_token")
    : localStorage.getItem("user_token")

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

/* ─────────────────────────────
   🔥 TRIGGER APIs
───────────────────────────── */

export const runTriggerNow = async () => {
  const res = await API.post("/triggers/run-now")
  return res.data
}

export const getTriggerStats = async () => {
  const res = await API.get("/triggers/stats")
  return res.data
}

export const getTriggerFeed = async () => {
  const res = await API.get("/triggers/feed")
  return res.data
}

export default API