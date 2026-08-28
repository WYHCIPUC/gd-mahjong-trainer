import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import Calculator from './ui/pages/Calculator';
import FirstRun from './ui/pages/FirstRun';
import Home from './ui/pages/Home';
import Play from './ui/pages/Play';
import Learn from './ui/pages/Learn';
import SettingsPage from './ui/pages/Settings';
import { getRepository } from './app/store';

const TABS = [
  { to: '/', label: '首页', testId: 'nav-home' },
  { to: '/play', label: '陪练', testId: 'nav-play' },
  { to: '/calculator', label: '计算器', testId: 'nav-calculator' },
  { to: '/learn', label: '学习', testId: 'nav-learn' },
  { to: '/settings', label: '设置', testId: 'nav-settings' },
];

export default function App() {
  // 首次启动检测：无设置 → 引导页（SC-5）
  const [settingsLoaded, setSettingsLoaded] = useState<boolean | null>(null);
  const [firstRun, setFirstRun] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await getRepository().then((r) => r.getSettings());
      if (s === null) {
        setFirstRun(true);
      }
      setSettingsLoaded(true);
    })();
  }, []);

  if (settingsLoaded === null) return <div className="page">加载中…</div>;
  if (firstRun) {
    return (
      <FirstRun
        onDone={() => {
          setFirstRun(false);
        }}
      />
    );
  }

  return (
    <div className="app">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Play />} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <nav className="bottom-nav">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className="nav-item" data-testid={t.testId}>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
