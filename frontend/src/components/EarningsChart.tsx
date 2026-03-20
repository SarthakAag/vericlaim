"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts"

interface EarningsRecord {
  id: number
  deliveries_completed: number
  total_earnings: number
}

export default function EarningsChart({ data }: { data: EarningsRecord[] }) {

  const chartData = data.map((r, index) => ({
    name: `Delivery ${index + 1}`,
    earnings: r.total_earnings
  }))

  return (

    <div className="mt-10">

      <h2 className="text-xl font-semibold mb-4">
        Earnings Chart
      </h2>

      <ResponsiveContainer width="100%" height={300}>

        <BarChart data={chartData}>

          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="name" />

          <YAxis />

          <Tooltip />

          <Bar dataKey="earnings" fill="#16a34a" />

        </BarChart>

      </ResponsiveContainer>

    </div>

  )
}