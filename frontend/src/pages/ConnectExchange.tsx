import { useState } from 'react'
import apiClient from '../api/client'

export default function ConnectExchange() {
  const [exchange, setExchange] = useState('binance')
  const [apiKey, setApiKey] = useState('')
  const [secret, setSecret] = useState('')
  const [message, setMessage] = useState('')

  const handleConnect = async () => {
    try {
      await apiClient.post('/exchanges/connect', { exchange, apiKey, secret })
      setMessage('Биржа успешно подключена!')
    } catch (err: any) {
      setMessage('Ошибка: ' + err.message)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Подключение биржи</h2>
      <select
        value={exchange}
        onChange={(e) => setExchange(e.target.value)}
        className="w-full p-2 mb-3 border rounded"
      >
        <option value="binance">Binance</option>
        <option value="kraken">Kraken</option>
        <option value="coinbase">Coinbase</option>
      </select>
      <input
        type="text"
        placeholder="API Key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        className="w-full p-2 mb-3 border rounded"
      />
      <input
        type="password"
        placeholder="Secret"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        className="w-full p-2 mb-4 border rounded"
      />
      <button onClick={handleConnect} className="w-full bg-green-600 text-white p-2 rounded">
        Подключить
      </button>
      {message && <p className="mt-3 text-sm">{message}</p>}
    </div>
  )
}
