'use client';

import type { SecondSample } from '@tecleo/engine';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface WpmChartProps {
  readonly timeline: readonly SecondSample[];
}

/** WPM neto acumulado, bruto por segundo y marcas en los segundos con errores. */
export function WpmChart({ timeline }: WpmChartProps) {
  const data = timeline.map((sample) => ({
    second: sample.second,
    wpm: Math.round(sample.wpm),
    raw: Math.round(sample.raw),
    errors: sample.errors,
    errorMark: sample.errors > 0 ? Math.round(sample.raw) : null,
  }));

  return (
    <figure className="h-56 w-full" aria-label="Gráfica de WPM por segundo">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#27272a" vertical={false} />
          <XAxis dataKey="second" stroke="#71717a" tickLine={false} fontSize={12} />
          <YAxis stroke="#71717a" tickLine={false} fontSize={12} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
            labelFormatter={(second) => <>segundo {second}</>}
            formatter={(value, name) => {
              const label = { wpm: 'wpm', raw: 'bruto', errorMark: 'errores' }[String(name)] ?? '';
              return [String(value), label];
            }}
          />
          <Line
            type="monotone"
            dataKey="raw"
            stroke="#71717a"
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="wpm"
            stroke="#fcd34d"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Scatter dataKey="errorMark" fill="#fb7185" shape="cross" isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}
