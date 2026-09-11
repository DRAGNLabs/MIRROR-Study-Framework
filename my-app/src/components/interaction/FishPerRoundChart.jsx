import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const LIGHT_COLORS = ["#0369a1", "#64748b", "#0d9488", "#7c3aed", "#dc2626"];
const DARK_COLORS = ["#38bdf8", "#94a3b8", "#2dd4bf", "#a78bfa", "#f87171"];

export default function FishPerRoundChart({ resourceHistory, playerKey, dark }) {
  if (!resourceHistory?.length) return null;

  const players = new Set();
  resourceHistory.forEach(({ allocations }) => {
    Object.keys(allocations || {}).forEach((k) => players.add(k));
  });
  const playerList = [...players];

  // Calculate cumulative totals
  const cumulativeTotals = {};
  playerList.forEach(p => {
    cumulativeTotals[p] = 0;
  });

  const chartData = resourceHistory.map(({ round, allocations }) => {
    const point = { round };
    playerList.forEach((p) => {
      const roundFish = allocations?.[p]?.fish ?? 0;
      cumulativeTotals[p] += roundFish;
      point[p] = cumulativeTotals[p];
    });
    return point;
  });

  const colors = dark ? DARK_COLORS : LIGHT_COLORS;
  const strokeColor = dark ? "#94a3b8" : "#64748b";

  return (
    <div className="resources-fish-chart">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={strokeColor} opacity={0.3} />
          <XAxis
            dataKey="round"
            type="number"
            tick={{ fontSize: 11, fill: strokeColor }}
            tickLine={{ stroke: strokeColor, opacity: 0.5 }}
            axisLine={{ stroke: strokeColor, opacity: 0.5 }}
          />
          <YAxis
            domain={[0, "auto"]}
            tick={{ fontSize: 11, fill: strokeColor }}
            tickLine={{ stroke: strokeColor, opacity: 0.5 }}
            axisLine={{ stroke: strokeColor, opacity: 0.5 }}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: dark ? "1px solid rgba(255,255,255,0.15)" : "1px solid #e2e8f0",
              background: dark ? "#1e293b" : "#fff",
              color: dark ? "#f1f5f9" : "#334155",
            }}
            formatter={(value, name) => [`${value} total fish`, `User ${name}`]}
            labelFormatter={(label) => `Round ${label}`}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => `User ${value}`}
            iconType="line"
            iconSize={10}
          />
          {playerList.map((player, i) => (
            <Line
              key={player}
              dataKey={player}
              name={player}
              type="monotone"
              stroke={colors[i % colors.length]}
              strokeWidth={1.5}
              dot={{ r: 2.5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}