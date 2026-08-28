import { Link } from 'react-router-dom';

const MODULES = [
  {
    to: '/play',
    icon: '🀄',
    title: 'AI 陪练对局',
    desc: '和三个 AI 打一整局。你每次出牌，教练会对比 AI 的选择，局后告诉你哪里亏了。',
  },
  {
    to: '/calculator',
    icon: '🧮',
    title: '听牌计算器',
    desc: '摆出 13 张牌，立刻告诉你听什么、每张等牌还剩几张、能胡多少番。',
  },
  {
    to: '/learn',
    icon: '📖',
    title: '学习中心',
    desc: '番种表全文、策略短文、选择题练习与无限随机出题，做错自动进错题本。',
  },
];

export default function Home() {
  return (
    <div className="page">
      <h2>广东麻将训练</h2>
      <p className="muted">先在陪练里打一局，再到学习中心看复盘讲解——进步最快的方式。</p>
      <div className="home-cards">
        {MODULES.map((m) => (
          <Link key={m.to} to={m.to} className="radio-card home-card" data-testid={`home-card-${m.to.slice(1)}`}>
            <span className="home-icon">{m.icon}</span>
            <span>
              <b>{m.title}</b>
              <br />
              <small>{m.desc}</small>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
