import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AccelerationOutput } from '../../engine';
import { fmt } from '../../lib/format';

interface Props {
  acceleration: AccelerationOutput;
}

const COLORS = {
  current: '#5A5A5A',
  size: '#B8972E',
  efficiency: '#B8972E',
  multiple: '#B8972E',
  blended: '#1D3A28',
};

export function AccelerationChart({ acceleration }: Props) {
  const data = [
    { name: 'Today', value: acceleration.currentValue, color: COLORS.current },
    { name: 'Grow revenue', value: acceleration.sizeValue, color: COLORS.size },
    { name: 'Improve margins', value: acceleration.efficiencyValue, color: COLORS.efficiency },
    { name: 'Reduce risk', value: acceleration.multipleValue, color: COLORS.multiple },
    { name: 'All three', value: acceleration.blendedSalePrice, color: COLORS.blended },
  ];

  return (
    <div className="w-full h-80">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 28, right: 16, left: 12, bottom: 8 }}>
          <CartesianGrid stroke="#E5DDC9" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#5A5A5A', fontSize: 13, fontFamily: 'Inter' }}
            axisLine={{ stroke: '#E5DDC9' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#8A8A8A', fontSize: 12, fontFamily: 'Inter' }}
            axisLine={{ stroke: '#E5DDC9' }}
            tickLine={false}
            tickFormatter={(v) => fmt.usd(v as number).replace('$', '$')}
            width={80}
          />
          <Tooltip
            cursor={{ fill: '#F5F0E8' }}
            formatter={(v: number) => [fmt.usd(v), 'Valuation']}
            contentStyle={{
              background: '#1D3A28',
              color: '#F5F0E8',
              border: 'none',
              borderRadius: 3,
              fontFamily: 'Inter',
              fontSize: 13,
            }}
            labelStyle={{ color: '#D4B850', fontWeight: 600 }}
          />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v: number) => fmt.usd(v)}
              fill="#2E2E2E"
              fontSize={12}
              fontFamily="Inter"
            />
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
