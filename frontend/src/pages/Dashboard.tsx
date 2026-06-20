import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiClient from '../api/client';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import BalanceChart from '../components/BalanceChart';
import { getPortfolioPnl, getCategories, setCategory } from '../api/portfolio';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function Dashboard() {
  const queryClient = useQueryClient();

  // ----- Форма добавления транзакции -----
  const [form, setForm] = useState({
    type: 'BUY',
    baseCurrency: 'BTC',
    quoteCurrency: 'USDT',
    baseAmount: '0.1',
    quoteAmount: '5000',
    fee: '5',
    feeCurrency: 'USDT',
    timestamp: '2025-01-15T10:00',
    notes: '',
  });

  // ----- Запросы данных -----
  const { data: portfolioData, isLoading: portfolioLoading } = useQuery('portfolio', () =>
    apiClient.get('/portfolio').then((res) => res.data)
  );
  const { data: pnlData } = useQuery('pnl', getPortfolioPnl);
  const { data: categories } = useQuery('categories', getCategories);

  // ----- Мутация для добавления транзакции -----
  const addTx = useMutation(
    (tx: any) => apiClient.post('/transactions/manual', tx),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('portfolio');
        queryClient.invalidateQueries('portfolioHistory');
        queryClient.invalidateQueries('pnl');
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
      timestamp: new Date(form.timestamp).toISOString(),
    });
  };

  if (portfolioLoading) return <div>Загрузка...</div>;

  // ----- Подготовка данных для круговой диаграммы -----
  const holdings = portfolioData?.holdings || {};
  const pieData = Object.entries(holdings).map(([currency, val]: any) => ({
    name: currency,
    value: Number(val.amount),
  }));

  // ----- Функция назначения категории -----
  const handleSetCategory = (currency: string) => {
    const cat = prompt(`Введите категорию для ${currency} (DeFi, Layer1, Stablecoin, Meme...)`);
    if (cat) {
      setCategory(currency, cat).then(() => {
        queryClient.invalidateQueries('categories');
        queryClient.invalidateQueries('portfolio');
      });
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Мой портфель</h1>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Круговая диаграмма */}
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

        {/* График истории баланса */}
        <BalanceChart />
      </div>

      {/* Прибыль/убыток по валютам */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg font-semibold mb-2">Прибыль/убыток по валютам</h2>
        {pnlData && pnlData.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">Валюта</th>
                <th className="text-right">Выручка</th>
                <th className="text-right">Себестоимость</th>
                <th className="text-right">Прибыль/убыток</th>
              </tr>
            </thead>
            <tbody>
              {pnlData.map((item: any) => (
                <tr key={item.currency}>
                  <td>{item.currency}</td>
                  <td className="text-right">{Number(item.proceeds).toFixed(2)}</td>
                  <td className="text-right">{Number(item.costBasis).toFixed(2)}</td>
                  <td className="text-right">{Number(item.gainLoss).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Нет данных о прибыли/убытке</p>
        )}
      </div>

      {/* Категории активов */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg font-semibold mb-2">Категории активов</h2>
        {categories && categories.length > 0 ? (
          <ul>
            {categories.map((cat: any) => (
              <li key={cat.id} className="flex justify-between">
                <span>{cat.currency}</span>
                <span className="text-sm text-gray-500">{cat.category}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>Категории не назначены</p>
        )}
        <button
          className="mt-2 bg-blue-600 text-white p-2 rounded"
          onClick={() => {
            const cur = prompt('Введите валюту (например, BTC)');
            if (cur) handleSetCategory(cur);
          }}
        >
          Назначить категорию
        </button>
      </div>

      {/* Форма добавления транзакции */}
      <div className="bg-white p-4 rounded shadow max-w-xl">
        <h2 className="text-lg font-semibold mb-2">Добавить транзакцию</h2>
        <form onSubmit={handleSubmit} className="space-y-2">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="border p-2 w-full"
          >
            <option value="BUY">Покупка</option>
            <option value="SELL">Продажа</option>
          </select>
          <input
            placeholder="Валюта (напр. BTC)"
            value={form.baseCurrency}
            onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })}
            className="border p-2 w-full"
          />
          <input
            placeholder="Валюта расчёта (напр. USDT)"
            value={form.quoteCurrency}
            onChange={(e) => setForm({ ...form, quoteCurrency: e.target.value })}
            className="border p-2 w-full"
          />
          <input
            placeholder="Количество"
            value={form.baseAmount}
            onChange={(e) => setForm({ ...form, baseAmount: e.target.value })}
            className="border p-2 w-full"
          />
          <input
            placeholder="Сумма в валюте расчёта"
            value={form.quoteAmount}
            onChange={(e) => setForm({ ...form, quoteAmount: e.target.value })}
            className="border p-2 w-full"
          />
          <input
            placeholder="Комиссия"
            value={form.fee}
            onChange={(e) => setForm({ ...form, fee: e.target.value })}
            className="border p-2 w-full"
          />
          <input
            placeholder="Валюта комиссии"
            value={form.feeCurrency}
            onChange={(e) => setForm({ ...form, feeCurrency: e.target.value })}
            className="border p-2 w-full"
          />
          <input
            type="datetime-local"
            value={form.timestamp}
            onChange={(e) => setForm({ ...form, timestamp: e.target.value })}
            className="border p-2 w-full"
          />
          <button type="submit" className="bg-blue-600 text-white p-2 rounded w-full">
            Добавить транзакцию
          </button>
        </form>
      </div>
    </div>
  );
}
