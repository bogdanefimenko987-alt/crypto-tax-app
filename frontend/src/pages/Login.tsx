import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const response = await apiClient.post(endpoint, { email, password });

      if (isRegister) {
        // После регистрации сразу входим
        const loginResponse = await apiClient.post('/auth/login', { email, password });
        localStorage.setItem('token', loginResponse.data.token);
      } else {
        localStorage.setItem('token', response.data.token);
      }

      navigate('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Ошибка запроса';
      setError(msg);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded shadow">
      <h2 className="text-xl font-bold mb-4">
        {isRegister ? 'Регистрация' : 'Вход'}
      </h2>

      {error && (
        <div className="mb-3 p-2 bg-red-100 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 mb-3 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
          required
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        >
          {isRegister ? 'Зарегистрироваться' : 'Войти'}
        </button>
      </form>

      <button
        onClick={() => {
          setIsRegister(!isRegister);
          setError('');
        }}
        className="mt-3 text-blue-500 underline w-full text-center"
      >
        {isRegister
          ? 'Уже есть аккаунт? Войти'
          : 'Нет аккаунта? Зарегистрироваться'}
      </button>
    </div>
  );
}

