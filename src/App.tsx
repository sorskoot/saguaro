import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import TimerPage from './pages/TimerPage';
import TasksPage from './pages/TasksPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<TimerPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/projects" element={<Navigate to="/tasks" replace />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
