import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MorningPick from './components/MorningPick';
import TimerPage from './pages/TimerPage';
import TasksPage from './pages/TasksPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <MorningPick>
          <Routes>
            <Route path="/" element={<TimerPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </MorningPick>
      </Layout>
    </HashRouter>
  );
}
