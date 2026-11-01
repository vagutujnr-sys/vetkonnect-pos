"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <header className="saas-header">
      <Link className="saas-brand" href="/" aria-label="VetKonnect home">
        <Image src="/vetkonnect-logo.png" alt="" width={46} height={46} priority />
        <span>VetKonnect <b>P.O.S &amp; Management</b></span>
      </Link>
      <nav className="saas-desktop-nav" aria-label="Main navigation">
        <a href="#platform">Platform</a>
        <a href="#pricing">Pricing</a>
        <Link href="/sign-in">Practice sign in</Link>
        <Link className="saas-nav-cta" href="/register">Create your practice <ArrowRight size={16} /></Link>
      </nav>
      <button
        className="saas-menu-toggle"
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="saas-mobile-menu"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      {open ? (
        <div className="saas-mobile-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <nav id="saas-mobile-menu" className="saas-mobile-drawer" aria-label="Mobile navigation">
            <div className="saas-mobile-drawer-head">
              <span>Explore VetKonnect</span>
              <button type="button" aria-label="Close menu" onClick={() => setOpen(false)}><X size={20} /></button>
            </div>
            <a href="#platform" onClick={() => setOpen(false)}>Platform</a>
            <a href="#pricing" onClick={() => setOpen(false)}>Pricing</a>
            <Link href="/sign-in" onClick={() => setOpen(false)}>Practice sign in</Link>
            <Link className="saas-mobile-create" href="/register" onClick={() => setOpen(false)}>
              Create your practice <ArrowRight size={17} />
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
