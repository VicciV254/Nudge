import { Link } from 'react-router-dom';
import { Logo, Mark } from '../components/common/Logo.jsx';
import Icon from '../components/common/Icon.jsx';
import { ThemeToggle } from '../components/layout/AppShell.jsx';

const FEATURES = [
  {
    icon: 'bell',
    title: 'Nudges, not nags',
    body: 'Miss something and Nudge quietly reschedules it instead of stacking up red badges and guilt.',
  },
  {
    icon: 'calendar',
    title: 'Two-way Google Calendar',
    body: 'Tasks with a due date become calendar events. Move the event, the task moves with it.',
  },
  {
    icon: 'flame',
    title: 'Momentum you can see',
    body: 'Streaks and completion stats that reward consistency rather than punishing an off day.',
  },
];

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing__nav">
        <Logo size={30} />
        <div className="landing__navr">
          <ThemeToggle />
          <Link className="btn btn--ghost btn--sm" to="/login">Sign in</Link>
          <Link className="btn btn--sm" to="/register">Get started</Link>
        </div>
      </header>

      <section className="hero">
        <span className="hero__pill">
          <Icon name="flame" size={13} /> Free while it&apos;s just you
        </span>
        <h1 className="hero__h1">
          A to-do app that
          <span className="hero__accent"> gently pushes you forward</span>
        </h1>
        <p className="hero__p">
          Nudge keeps your tasks and your calendar in one place, and moves what you miss
          instead of shouting about it.
        </p>
        <div className="hero__cta">
          <Link className="btn btn--lg" to="/register">Start for free</Link>
          <Link className="btn btn--ghost btn--lg" to="/login">I have an account</Link>
        </div>

        {/* Product peek — real components, same tokens. */}
        <div className="peek card">
          <div className="peek__bar">
            <span className="peek__dot" /><span className="peek__dot" /><span className="peek__dot" />
            <span className="peek__title">Today</span>
          </div>
          <ul className="peek__list">
            {[
              { t: 'Send Q3 report to Amina', m: 'Today 09:00 · Work', p: 'urgent', done: false },
              { t: 'Book dentist', m: 'Overdue 2d', p: 'high', done: false },
              { t: 'Reply to landlord', m: 'Yesterday', p: null, done: true },
            ].map((r) => (
              <li key={r.t} className={`peek__row ${r.done ? 'peek__row--done' : ''}`}>
                <span className={`peek__cb ${r.done ? 'peek__cb--on' : ''}`}>
                  {r.done && <Icon name="check" size={11} strokeWidth={3.4} />}
                </span>
                <span className="peek__body">
                  <span className="peek__t">{r.t}</span>
                  <span className="peek__m">{r.m}</span>
                </span>
                {r.p && <span className={`chip chip--${r.p}`}>{r.p}</span>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="features">
        {FEATURES.map((f) => (
          <div key={f.title} className="feature card">
            <span className="feature__ic"><Icon name={f.icon} size={19} /></span>
            <h3 className="feature__t">{f.title}</h3>
            <p className="feature__b">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="landing__foot">
        <Mark size={22} />
        <span>Nudge — a to-do app that gently pushes you forward.</span>
      </footer>
    </div>
  );
}
