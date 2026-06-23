import { Suspense, lazy, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import apiClient from '../api/client';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { getCategories, setCategory } from '../api/portfolio';

const BalanceChart = lazy(() => import('../components/BalanceChart'));
const PnLTable = lazy(() => import('../components/PnLTable'));

const COLORS = ['#0088FE','#00C49F','#FFBB28','#FF8042','#8884d8'];

export default function Dashboard() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    type: 'BUY', baseCurrency: 'BTC', quoteCurrency: 'USDT',
    baseAmount: '0.1', quoteAmount: '5000', fee: '5', feeCurrency: 'USDT',
    timestamp: new Date().toISOString().slice(0,16), notes: ''
  });
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());

  const { data: port } = useQuery('portfolio', () => apiClient.get('/portfolio').then(r => r.data).catch(() => ({ holdings: {} })));
  const { data: cats } = useQuery('categories', getCategories, { onError: () => [] });
  const { data: tax } = useQuery(['tax', taxYear], () => apiClient.get(`/tax/report/${taxYear}`).then(r => r.data).catch(() => null));

  const add = useMutation((tx: any) => apiClient.post('/transactions/manual', tx), {
    onSuccess: () => { qc.invalidateQueries(); alert('Транзакция добавлена'); },
    onError: (e: any) => alert('Ошибка: ' + (e.response?.data?.error || e.message))
  });

  const submit = (e: React.FormEvent) => { e.preventDefault();
    add.mutate({ ...form, baseAmount: Number(form.baseAmount), quoteAmount: Number(form.quoteAmount), fee: Number(form.fee), timestamp: new Date(form.timestamp).toISOString() });
  };

  const h = port?.holdings || {};
  const pie = Object.entries(h).map(([name, val]: any) => ({ name, value: Number(val.amount)||0 }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Дашборд</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <h2>Структура портфеля</h2>
          {pie.length===0 ? <p>Нет активов</p> : (
            <PieChart width={400} height={300}>
              <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                {pie.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Pie>
              <Tooltip/><Legend/>
            </PieChart>
          )}
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h2>Добавить транзакцию</h2>
          <form onSubmit={submit} className="space-y-2">
            <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} className="border p-2 w-full">
              <option value="BUY">Покупка</option><option value="SELL">Продажа</option>
            </select>
            <input placeholder="Валюта (BTC)" value={form.baseCurrency} onChange={e=>setForm({...form,baseCurrency:e.target.value})} className="border p-2 w-full"/>
            <input placeholder="Валюта расчёта (USDT)" value={form.quoteCurrency} onChange={e=>setForm({...form,quoteCurrency:e.target.value})} className="border p-2 w-full"/>
            <input placeholder="Количество" type="number" step="any" value={form.baseAmount} onChange={e=>setForm({...form,baseAmount:e.target.value})} className="border p-2 w-full"/>
            <input placeholder="Сумма" type="number" step="any" value={form.quoteAmount} onChange={e=>setForm({...form,quoteAmount:e.target.value})} className="border p-2 w-full"/>
            <input placeholder="Комиссия" type="number" step="any" value={form.fee} onChange={e=>setForm({...form,fee:e.target.value})} className="border p-2 w-full"/>
            <input type="datetime-local" value={form.timestamp} onChange={e=>setForm({...form,timestamp:e.target.value})} className="border p-2 w-full"/>
            <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">Добавить</button>
          </form>
        </div>
      </div>

      <Suspense fallback={<div className="p-4 text-center">Загрузка графика...</div>}><BalanceChart/></Suspense>
      <Suspense fallback={<div className="p-4 text-center">Загрузка PnL...</div>}><PnLTable/></Suspense>

      <div className="bg-white p-4 rounded shadow mb-6">
        <h2>Категории</h2>
        {cats?.length ? <ul>{cats.map((c:any)=><li key={c.id}>{c.currency} – {c.category}</li>)}</ul> : <p>Нет категорий</p>}
        <button className="mt-2 bg-blue-600 text-white p-2 rounded" onClick={()=>{const cur=prompt('Валюта?'); if(cur) setCategory(cur, prompt('Категория?')||'').then(()=>qc.invalidateQueries('categories'));}}>Назначить</button>
      </div>

      <div className="bg-white p-4 rounded shadow mb-6">
        <h2>Налоговый отчёт</h2>
        <input type="number" value={taxYear} onChange={e=>setTaxYear(Number(e.target.value))} className="border p-2 w-24"/>
        {tax && <div className="mt-2"><p>Прибыль: {Number(tax.summary.totalGain).toFixed(2)}</p><p>Налог: {Number(tax.summary.totalTax).toFixed(2)}</p></div>}
        <a href={`/api/tax/report/${taxYear}/csv`} className="bg-green-600 text-white p-2 rounded mr-2">CSV</a>
        <a href={`/api/tax/report/${taxYear}/pdf`} className="bg-red-600 text-white p-2 rounded">PDF</a>
      </div>
    </div>
  );
}
