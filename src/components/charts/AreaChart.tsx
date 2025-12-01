"use client";

import dynamic from 'next/dynamic';
import { ResponsiveContainer, AreaChart as RechartsArea, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

// Definição de tipo para evitar o "any"
interface ChartData {
  name: string;
  amount: number;
}

const AreaChartComponent = ({ data }: { data: ChartData[] }) => {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsArea data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Area type="monotone" dataKey="amount" stroke="#8884d8" fill="#8884d8" />
        </RechartsArea>
      </ResponsiveContainer>
    </div>
  );
};

export default dynamic(() => Promise.resolve(AreaChartComponent), {
  ssr: false
});