"use client";

import { useEffect, useState } from "react";

export function LocalStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let stop = false;
    async function ping() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        if (!stop) setOnline(response.ok);
      } catch {
        if (!stop) setOnline(false);
      }
    }
    ping();
    const timer = setInterval(ping, 20000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <>
      <span className={online ? "local-pill" : "local-pill down"}>
        <i />
        {online ? "ONLINE" : "CONNECTION LOST"}
      </span>
    </>
  );
}
