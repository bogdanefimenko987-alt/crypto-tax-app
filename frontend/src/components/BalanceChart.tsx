import { useQuery } from 'react-query';
import { getPortfolioHistory } from '../api/portfolio';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const color = (str: string) => '#' + Math.floor(Math.abs(Math.sin(str.split('').reduce((a,c)=>a+c.charCodeAt(0),0)))*16777215).toString(16).padStart(6,'0');

export default function BalanceChart() {
  const { data, isLoading } = useQuery('portfolioHistory', getPortfolioHistory);
  if (isLoading) return <div className="p-4 text-center">Загрузка графика...</div>;
  if (!data || data.length===0) return <div className="p-4 text-center">Нет данных</div>;

  const currencies = Object.keys(data[0]).filter(k => k!=='date');
  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <h2>История баланса</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          {currencies.map(c => <Line key={c} type="monotone" dataKey={c} stroke={color(c)} dot={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}