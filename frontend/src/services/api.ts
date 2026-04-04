import axios from "axios"

const API = axios.create({
  baseURL: "http://127.0.0.1:8000"
})

API.interceptors.request.use((config) => {

  // ── Send admin_token for /admin/* routes, user_token for everything else ──
  const isAdminRoute = config.url?.startsWith("/admin")
  const token = isAdminRoute
    ? localStorage.getItem("admin_token")
    : localStorage.getItem("user_token")

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

export default API