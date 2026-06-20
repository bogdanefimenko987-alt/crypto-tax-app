import { useQuery } from 'react-query';
import { getPortfolioHistory } from '../api/portfolio';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Генератор стабильного цвета по названию валюты
const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = Math.floor(Math.abs(Math.sin(hash) * 16777215) % 16777215).toString(16);
  return '#' + '0'.repeat(6 - color.length) + color;
};

export default function BalanceChart() {
  const { data, isLoading, error } = useQuery('portfolioHistory', getPortfolioHistory);

  if (isLoading) return <div className="p-4 text-center">Загрузка графика...</div>;
  if (error || !data || data.length === 0)
    return <div className="p-4 text-center">Нет данных для отображения истории</div>;

  const currencies = Object.keys(data[0]).filter((key) => key !== 'date');

  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-lg font-semibold mb-2">Исторический баланс</h2>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          {currencies.map((currency) => (
            <Line
              key={currency}
              type="monotone"
              dataKey={currency}
              stroke={stringToColor(currency)}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}