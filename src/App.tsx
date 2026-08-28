import { NavLink, Route, Routes } from 'react-router-dom';
import Calculator from './ui/pages/Calculator';
import Home from './ui/pages/Home';
import Play from './ui/pages/Play';
import Learn from './ui/pages/Learn';
import Settings from './ui/pages/Settings';

const TABS = [
  { to: '/', label: '首页', testId: 'nav-home' },
  { to: '/play', label: '陪练', testId: 'nav-play' },
  { to: '/calculator', label: '计算器', testId: 'nav-calculator' },
  { to: '/learn', label: '学习', testId: 'nav-learn' },
  { to: '/settings', label: '设置', testId: 'nav-settings' },
];

export default function App() {
  return (
    <div className="app">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Play />} />
          <Route path="/calculator" element={<Calculator />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/settings" element={<Settings />} />
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
