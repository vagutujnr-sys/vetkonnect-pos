"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { unlockWithPin } from "@/server/actions";
import { LocalStatus } from "./LocalStatus";
import { PinPad } from "./PinPad";

const links = [
  { href: "/home", label: "Home" },
  { href: "/patients", label: "Patients" },
  { href: "/visit/new", label: "Visit" },
  { href: "/pharmacy", label: "Pharmacy" },
  { href: "/more", label: "More" },
];

export function Shell({
  children,
  clinic,
  userName,
  timeoutMinutes,
  notices = [],
}: {
  children: React.ReactNode;
  clinic: string;
  userName: string;
  timeoutMinutes: number;
  notices?: { id: string; title: string; body: string; href: string | null }[];
}) {
  const pathname = usePathname();
  const isPos = pathname === "/pos" || pathname.endsWith("/pos");
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const lockNow = () => setLocked(true);
    window.addEventListener("ap-lock", lockNow);
    return () => window.removeEventListener("ap-lock", lockNow);
  }, []);

  useEffect(() => {
    let timer = window.setTimeout(() => setLocked(true), timeoutMinutes * 60 * 1000);
    const reset = () => {
      window.clearTimeout(timer);
      if (!locked) timer = window.setTimeout(() => setLocked(true), timeoutMinutes * 60 * 1000);
    };
    const events = ["pointerdown", "keydown"];
    events.forEach((event) => window.addEventListener(event, reset));
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [locked, timeoutMinutes]);

  return (
    <div className={`shell${isPos ? " shell-pos" : ""}`}>
      {!isPos ? <nav className="rail">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={`${pathname.startsWith(link.href) ? "active" : ""} ${link.href === "/visit/new" ? "visit-link" : ""}`}>
            {link.href === "/visit/new" ? "+" : null}
            {link.label}
          </Link>
        ))}
      </nav> : null}
      <div>
        {!isPos ? <header className="topbar">
          <div className="brand-lockup">
            <img src="/logo.png" alt="" />
            <div>
              <strong>{clinic}</strong>
              <span>{userName}</span>
            </div>
          </div>
          <LocalStatus />
        </header> : null}
        <main className="main">
          {!isPos && notices[0] ? (
            <Link className="notice-bar" href={`/notifications/${notices[0].id}`}>
              <strong>{notices.length > 1 ? `${notices.length} new notices` : notices[0].title}</strong>
              <span>{notices[0].body}</span>
            </Link>
          ) : null}
          {children}
        </main>
      </div>
      {!isPos ? <nav className="bottom-nav">
        {links.map((link) =>
          link.href === "/visit/new" ? (
            <Link key={link.href} href={link.href} className="nav-visit" aria-label="New visit">
              <span className="visit-fab" aria-hidden="true"><b>+</b></span>
              Visit
            </Link>
          ) : (
            <Link key={link.href} href={link.href} className={pathname.startsWith(link.href) ? "active" : ""}>
              {link.label}
            </Link>
          ),
        )}
      </nav> : null}
      {locked ? (
        <div className="lock">
          <div className="login-card">
            <PinPad title="Locked" subtitle={userName} onSubmit={async (pin) => {
              const result = await unlockWithPin(pin);
              if (result.ok) setLocked(false);
              return result;
            }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
