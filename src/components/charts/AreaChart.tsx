"use client";

import dynamic from "next/dynamic";
import {
  ResponsiveContainer,
  AreaChart as RechartsArea,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import type { Payload } from "recharts/types/component/DefaultTooltipContent";
import { useUiText } from "@/i18n/T";
import { useFormatters } from "@/i18n/useFormatters";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";

interface ChartData {
  name: string;
  amount: number;
}

// Tipos do seu gráfico: value = number (amount), name = string (dataKey/label)
type TooltipPayload = Payload<number, string>;

type CustomTooltipProps = {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
};

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  const tt = useUiText();
  const currency = usePreferredCurrency();
  const { money } = useFormatters(currency);
  if (!active || !payload || payload.length === 0) return null;

  const raw = payload[0]?.value;
  const value = typeof raw === "number" ? raw : Number(raw);
  // Define a cor baseada no valor (Positivo = Verde / Negativo = Vermelho) ou Neutro (Violeta)
  // Para fluxo acumulado, geralmente queremos ver o saldo crescer.
  const colorClass = value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  const bgClass = value >= 0 ? "bg-emerald-500" : "bg-red-500";

  return (
    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl p-4 min-w-[180px] animate-in fade-in zoom-in-95 duration-200">
      <p className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold mb-2 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-1">
        {String(label ?? "")}
      </p>

      <div className="flex items-center gap-3 mt-2">
        <div className={`w-1.5 h-8 rounded-full ${bgClass}`} />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-zinc-400 font-bold tracking-wider">{tt("Saldo Acumulado")}</span>
          <span className={`text-xl font-bold tracking-tight ${colorClass}`}>
            {money(value)}
          </span>
        </div>
      </div>
    </div>
  );
}

const AreaChartComponent = ({ data }: { data: ChartData[] }) => {
  const tt = useUiText();
  const currency = usePreferredCurrency();
  const { number } = useFormatters(currency);

  if (!data || data.length === 0) {
    return (
      <div className="app-panel-subtle flex h-[300px] w-full flex-col items-center justify-center rounded-2xl border border-dashed text-zinc-400 animate-in fade-in">
        <p className="text-sm font-medium">{tt("Nenhum dado financeiro para exibir.")}</p>
      </div>
    );
  }

  return (
    <div className="h-[300px] min-h-[300px] w-full min-w-0 select-none">
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={300}
        initialDimension={{ width: 1, height: 300 }}
      >
        <RechartsArea data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#e4e4e7"
            className="stroke-zinc-200 dark:stroke-zinc-800"
          />

          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#a1a1aa", fontSize: 11, fontWeight: 500 }}
            dy={10}
            minTickGap={30}
            // Se for mensal, mostra abreviações. Se diário, mostra dias.
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#a1a1aa", fontSize: 11, fontWeight: 500 }}
            tickFormatter={(value) =>
              number(Number(value), {
                notation: "compact",
                compactDisplay: "short",
              })
            }
          />

          <Tooltip
            content={(props: unknown) => <CustomTooltip {...(props as CustomTooltipProps)} />}
            cursor={{ stroke: "#8b5cf6", strokeWidth: 2, strokeDasharray: "4 4", opacity: 0.5 }}
          />

          <Area
            type="monotone"
            dataKey="amount"
            stroke="#8b5cf6"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorAmount)"
            animationDuration={1500}
            activeDot={{
              r: 6,
              style: { fill: "#8b5cf6", stroke: "white", strokeWidth: 4 },
            }}
          />
        </RechartsArea>
      </ResponsiveContainer>
    </div>
  );
};

export default dynamic(() => Promise.resolve(AreaChartComponent), { ssr: false });
