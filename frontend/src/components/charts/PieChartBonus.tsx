"use client"

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from "recharts"

const COLORS = ["#22c55e", "#3b82f6", "#f97316"]

export default function PieChartBonus({ weather, traffic, insurance }: any) {

  const data = [
    { name: "Weather Bonus", value: weather },
    { name: "Traffic Bonus", value: traffic },
    { name: "Insurance Protection", value: insurance }
  ]

  return (

    <div className="bg-white p-6 rounded shadow">

      <h2 className="text-lg font-semibold mb-4">
        Bonus Distribution
      </h2>

      <ResponsiveContainer width="100%" height={300}>

        <PieChart>

          <Pie
            data={data}
            dataKey="value"
            outerRadius={120}
            label
          >

            {data.map((entry, index) => (
              <Cell key={index} fill={COLORS[index]} />
            ))}

          </Pie>

          <Tooltip />

        </PieChart>

      </ResponsiveContainer>

    </div>

  )
}