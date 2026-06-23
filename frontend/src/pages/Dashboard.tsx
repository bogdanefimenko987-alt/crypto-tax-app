import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiClient from '../api/client';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    type: 'BUY',
    baseCurrency: 'BTC',
    quoteCurrency: 'USDT',
    baseAmount: '0.1',
    quoteAmount: '5000',
    fee: '5',
    feeCurrency: 'USDT',
    timestamp: new Date().toISOString().slice(0, 16),
    notes: '',
  });

  const { data: portfolioData, isLoading } = useQuery('portfolio', () =>
    apiClient.get('/portfolio').then(res => res.data)
  );

  const addTx = useMutation(
    (tx: any) => apiClient.post('/transactions/manual', tx),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('portfolio');
        alert('Транзакция добавлена');
      },
      onError: (err: any) => {
        alert('Ошибка: ' + (err.response?.data?.error || err.message));
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTx.mutate({
      ...form,
      baseAmount: Number(form.baseAmount),
      quoteAmount: Number(form.quoteAmount),
      fee: Number(form.fee),
      timestamp: new Date(form.timestamp).toISOString(),
    });
  };

  if (isLoading) return <div className="p-4 text-center">Загрузка...</div>;

  const holdings = portfolioData?.holdings || {};
  const pieData = Object.entries(holdings).map(([name, value]: any) => ({
    name,
    value: Number(value.amount) || 0,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Дашборд</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Структура портфеля</h2>
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

        {/* Форма добавления транзакции */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Добавить транзакцию</h2>
          <form onSubmit={handleSubmit} className="space-y-2">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="border p-2 w-full">
              <option value="BUY">Покупка</option>
              <option value="SELL">Продажа</option>
            </select>
            <input placeholder="Валюта (BTC)" value={form.baseCurrency} onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })} className="border p-2 w-full" />
            <input placeholder="Валюта расчёта (USDT)" value={form.quoteCurrency} onChange={(e) => setForm({ ...form, quoteCurrency: e.target.value })} className="border p-2 w-full" />
            <input placeholder="Количество" type="number" step="any" value={form.baseAmount} onChange={(e) => setForm({ ...form, baseAmount: e.target.value })} className="border p-2 w-full" />
            <input placeholder="Сумма" type="number" step="any" value={form.quoteAmount} onChange={(e) => setForm({ ...form, quoteAmount: e.target.value })} className="border p-2 w-full" />
            <input placeholder="Комиссия" type="number" step="any" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} className="border p-2 w-full" />
            <input type="datetime-local" value={form.timestamp} onChange={(e) => setForm({ ...form, timestamp: e.target.value })} className="border p-2 w-full" />
            <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">Добавить</button>
          </form>
        </div>
      </div>
    </div>
  );
}