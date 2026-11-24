import { Link } from "react-router";

const steps = [
  { number: "01", title: "Name your goal", copy: "Start with a career direction or a skill you want to build." },
  { number: "02", title: "Choose a move", copy: "Turn that goal into a practical action you can take this week." },
  { number: "03", title: "Share your evidence", copy: "Show what you did and invite someone to review it." },
  { number: "04", title: "See your growth", copy: "Track skill progress and the opportunities it can open." },
];

export default function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero" aria-labelledby="landing-title">
        <header className="landing-header">
          <Link to="/" className="landing-brand" aria-label="Impact++ home">
            <img src="/icons/ieee-logo.png" alt="IEEE" />
            <span>Impact++</span>
          </Link>
          <nav className="landing-nav" aria-label="Main">
            <a href="#how-it-works">How it works</a>
            <Link to="/auth/sign-in">Sign in</Link>
            <Link to="/auth/sign-up?next=%2F" className="landing-nav-cta">Create account</Link>
          </nav>
        </header>

        <div className="landing-hero-content">
          <p className="landing-eyebrow">A growth workspace for computer science students</p>
          <h1 id="landing-title">Impact++</h1>
          <p className="landing-lede">Turn what you want to do into progress you can show.</p>
          <p className="landing-description">Set a career goal, take a focused next step, and build a record of the skills you grow along the way.</p>
          <div className="landing-actions">
            <Link to="/auth/sign-up?next=%2F" className="landing-primary">Get started <span aria-hidden="true">&#8594;</span></Link>
            <Link to="/auth/sign-in" className="landing-secondary">Sign in</Link>
          </div>
          <p className="landing-audience">Built for CS students ready to turn ambition into action.</p>
        </div>
        <a className="landing-scroll" href="#how-it-works" aria-label="Explore how Impact++ works"><span aria-hidden="true" /></a>
      </section>

      <section id="how-it-works" className="landing-process" aria-labelledby="process-title">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">A practical path forward</p>
          <h2 id="process-title">Small steps. Real evidence. Visible growth.</h2>
          <p>Impact++ connects the work you do to the skills and opportunities you want next.</p>
        </div>
        <ol className="landing-steps">
          {steps.map((step) => (
            <li key={step.number}>
              <span className="landing-step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-bottom-cta" aria-label="Get started with Impact++">
        <div>
          <p className="landing-eyebrow">Your next step starts here</p>
          <h2>Make progress you can point to.</h2>
        </div>
        <Link to="/auth/sign-up?next=%2F" className="landing-primary">Create your account <span aria-hidden="true">&#8594;</span></Link>
      </section>
      <footer className="landing-footer"><span>Impact++</span><span>IEEE student project · Built for CS students</span></footer>
    </main>
  );
}
