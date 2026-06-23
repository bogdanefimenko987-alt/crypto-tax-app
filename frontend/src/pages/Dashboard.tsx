import { useQuery } from 'react-query';
import apiClient from '../api/client';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import BalanceChart from '../components/BalanceChart';
import { getPortfolioPnl, getCategories } from '../api/portfolio';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function Dashboard() {
  const { data: portfolioData, isLoading } = useQuery('portfolio', () =>
    apiClient.get('/portfolio').then(res => res.data).catch(() => ({ holdings: {} }))
  );
  const { data: pnlData } = useQuery('pnl', getPortfolioPnl, { onError: () => [] });
  const { data: categories } = useQuery('categories', getCategories, { onError: () => [] });

  if (isLoading) return <div className="p-4 text-center">Загрузка...</div>;

  const holdings = portfolioData?.holdings || {};
  const pieData = Object.entries(holdings).map(([name, value]: any) => ({
    name,
    value: Number(value.amount || 0),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Дашборд</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Структура активов</h2>
          {pieData.length === 0 ? (
            <p>Нет активов</p>
          ) : (
            <PieChart width={400} height={300}>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                {pieData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          )}
        </div>
        <BalanceChart />
      </div>
    </div>
  );
}