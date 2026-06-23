import { useQuery } from 'react-query';
import { getPortfolioPnl } from '../api/portfolio';

export default function PnLTable() {
  const { data, isLoading } = useQuery('pnl', getPortfolioPnl);

  if (isLoading) return <div className="p-4 text-center">Загрузка PnL...</div>;
  if (!data || data.length === 0) return <div className="p-4 text-center">Нет данных о прибыли/убытке</div>;

  return (
    <div className="bg-white p-4 rounded shadow mb-6">
      <h2 className="text-lg font-semibold mb-2">Прибыль/убыток по валютам</h2>
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
          {data.map((item: any) => (
            <tr key={item.currency}>
              <td>{item.currency}</td>
              <td className="text-right">{Number(item.proceeds).toFixed(2)}</td>
              <td className="text-right">{Number(item.costBasis).toFixed(2)}</td>
              <td
                className="text-right"
                style={{ color: Number(item.gainLoss) >= 0 ? 'green' : 'red' }}
              >
                {Number(item.gainLoss).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}