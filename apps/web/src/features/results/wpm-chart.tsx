'use client';

import type { SecondSample } from '@tecleo/engine';
import { useTranslations } from 'next-intl';
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

import { useSettings } from '@/settings/settings-store';
import { THEME_TOKENS } from '@/theme/themes';

interface WpmChartProps {
  readonly timeline: readonly SecondSample[];
}

/** WPM neto acumulado, bruto por segundo y marcas en los segundos con errores. */
export function WpmChart({ timeline }: WpmChartProps) {
  const t = useTranslations('results');
  // Recharts dibuja SVG con atributos: los colores salen de los tokens del tema activo.
  const colors = THEME_TOKENS[useSettings().theme];
  const data = timeline.map((sample) => ({
    second: sample.second,
    wpm: Math.round(sample.wpm),
    raw: Math.round(sample.raw),
    errorMark: sample.errors > 0 ? Math.round(sample.raw) : null,
  }));
  const names: Record<string, string> = {
    wpm: t('chartWpm'),
    raw: t('chartRaw'),
    errorMark: t('chartErrors'),
  };

  return (
    <figure className="h-56 w-full" aria-label={t('chartLabel')}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={colors.border} vertical={false} />
          <XAxis dataKey="second" stroke={colors.mutedForeground} tickLine={false} fontSize={12} />
          <YAxis
            stroke={colors.mutedForeground}
            tickLine={false}
            fontSize={12}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              color: colors.foreground,
            }}
            labelFormatter={(second) => <>{t('chartSecond', { second: Number(second) })}</>}
            formatter={(value, name) => [String(value), names[String(name)] ?? '']}
          />
          <Line
            type="linear"
            dataKey="raw"
            stroke={colors.pending}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="wpm"
            stroke={colors.accent}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
          <Scatter
            dataKey="errorMark"
            fill={colors.error}
            shape="cross"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}
