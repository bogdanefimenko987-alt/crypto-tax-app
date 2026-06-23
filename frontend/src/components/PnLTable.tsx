import { useQuery } from 'react-query';
import { getPortfolioPnl } from '../api/portfolio';

export default function PnLTable() {
  const { data, isLoading } = useQuery('pnl', getPortfolioPnl);
  if (isLoading) return <div className="p-4 text-center">Загрузка PnL...</div>;
  if (!data || data.length===0) return <div className="p-4 text-center">Нет данных</div>;

  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <h2>Прибыль/убыток</h2>
      <table className="w-full">
        <thead><tr><th>Валюта</th><th>Выручка</th><th>Себестоимость</th><th>Прибыль</th></tr></thead>
        <tbody>
          {data.map((item: any) => (
            <tr key={item.currency}>
              <td>{item.currency}</td>
              <td>{Number(item.proceeds).toFixed(2)}</td>
              <td>{Number(item.costBasis).toFixed(2)}</td>
              <td style={{color: item.gainLoss>=0?'green':'red'}}>{Number(item.gainLoss).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}