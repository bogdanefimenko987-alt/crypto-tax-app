import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow p-4 flex justify-between">
        <div className="space-x-4">
          <Link to="/dashboard" className="text-blue-600">Дашборд</Link>
          {token && <Link to="/connect" className="text-blue-600">Биржи</Link>}
        </div>
        <div>
          {token ? (
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="text-red-500"
            >
              Выйти
            </button>
          ) : (
            <Link to="/login" className="text-blue-600">Войти</Link>
          )}
        </div>
      </nav>
      <main className="p-4">{children}</main>
    </div>
  );
}
