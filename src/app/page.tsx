import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Boxes, ClipboardPlus, CreditCard, PawPrint, Pill, ShieldCheck, Stethoscope } from "lucide-react";

const features = [
  { Icon: PawPrint, title: "Patient records", description: "Keep owners, pets, clinical history and follow-ups connected." },
  { Icon: Stethoscope, title: "Consultations", description: "Move from patient check-in to treatment notes in one calm workflow." },
  { Icon: Pill, title: "Pharmacy", description: "Track batches, prescriptions, dispensing and expiry dates together." },
  { Icon: Boxes, title: "Stock and sales", description: "See what is moving, what is low and what each sale included." },
  { Icon: CreditCard, title: "Point of sale", description: "Take payments for services, medication and products at the desk." },
  { Icon: ShieldCheck, title: "Practice control", description: "Give staff the access they need while keeping administration protected." },
];

export default function LandingPage() {
  return (
    <main className="saas-site">
      <header className="saas-header">
        <Link className="saas-brand" href="/" aria-label="VetKonnect home">
          <Image src="/vetkonnect-logo.png" alt="" width={46} height={46} priority />
          <span>VetKonnect <b>P.O.S &amp; Management</b></span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#platform">Platform</a>
          <a href="#pricing">Pricing</a>
          <Link href="/register">Practice sign in</Link>
          <Link href="/platform/login">Platform admin</Link>
          <Link className="saas-nav-cta" href="/register">Create your practice <ArrowRight size={16} /></Link>
        </nav>
      </header>

      <section className="saas-hero">
        <div className="saas-hero-copy">
          <span className="saas-kicker"><i /> MADE FOR VETERINARY PRACTICES</span>
          <h1>VetKonnect<br /><em>P.O.S &amp; Management</em></h1>
          <p className="saas-hero-lede">The work behind great care, finally working together.</p>
          <p className="saas-hero-body">Bring patient records, consultations, pharmacy, stock and payments into one clear system made for the way veterinary teams work.</p>
          <div className="saas-hero-actions">
            <Link className="saas-button" href="/register">Set up your practice <ArrowRight size={18} /></Link>
            <a className="saas-text-link" href="#platform">Explore the platform</a>
          </div>
          <div className="saas-price-note"><strong>$5</strong><span>per practice, per month<br />No trial. No setup fee.</span></div>
        </div>
        <div className="saas-hero-visual" aria-label="VetKonnect point of sale preview">
          <div className="saas-visual-label"><span>ONE CONNECTED WORKSPACE</span><b>Care in. Clarity out.</b></div>
          <Image src="/pos-preview.png" alt="A preview of the VetKonnect veterinary point of sale screen" width={1600} height={1067} priority />
          <div className="saas-visual-caption"><span><i /> PATIENTS</span><span><i /> PHARMACY</span><span><i /> POS</span></div>
        </div>
        <div className="saas-hero-index" aria-hidden="true">01 / PRACTICE, CONNECTED</div>
      </section>

      <section className="saas-proof" aria-label="Product values">
        <p><ClipboardPlus size={19} /> Clinical records that stay connected</p>
        <p><Boxes size={19} /> Stock that makes sense at a glance</p>
        <p><CreditCard size={19} /> A simpler end to the working day</p>
      </section>

      <section className="saas-platform" id="platform">
        <div className="saas-section-intro">
          <span className="saas-kicker">THE PRACTICE, IN ONE PLACE</span>
          <h2>Less app-switching.<br /><em>More time for animals.</em></h2>
          <p>From the first patient detail to the final receipt, VetKonnect brings the everyday jobs of a veterinary practice into a single, purpose-built workspace.</p>
        </div>
        <div className="saas-feature-grid">
          {features.map(({ Icon, title, description }, index) => (
            <article className="saas-feature" key={title}>
              <span className="saas-feature-number">0{index + 1}</span>
              <Icon size={23} strokeWidth={1.8} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="saas-pricing" id="pricing">
        <div>
          <span className="saas-kicker">STRAIGHTFORWARD BY DESIGN</span>
          <h2>One clear price.<br /><em>Your whole practice.</em></h2>
          <p>Every core tool your team needs, in one subscription. Start when you are ready and cancel any time.</p>
        </div>
        <div className="saas-price-panel">
          <span>VETKONNECT PRACTICE PLAN</span>
          <div className="saas-price"><strong>$5</strong><span>USD / month<br />per practice</span></div>
          <ul><li>Patient and owner records</li><li>Consultations and prescriptions</li><li>Pharmacy, stock and point of sale</li><li>Reports and staff management</li><li>No trial period or setup fee</li></ul>
          <Link className="saas-button saas-button-light" href="/register">Register your practice <ArrowRight size={18} /></Link>
          <small>Secure checkout. Your practice is activated after subscription.</small>
        </div>
      </section>

      <footer className="saas-footer">
        <Link className="saas-brand" href="/">
          <Image src="/vetkonnect-logo.png" alt="" width={36} height={36} />
          <span>VetKonnect <b>P.O.S &amp; Management</b></span>
        </Link>
        <span>Thoughtful software for the people who care for animals.</span>
        <a href="mailto:hello@vetkonnect.org">Contact</a>
        <small>© {new Date().getFullYear()} VetKonnect</small>
      </footer>
    </main>
  );
}
