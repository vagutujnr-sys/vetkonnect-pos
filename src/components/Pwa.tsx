"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

export function Pwa() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosInstall, setShowIosInstall] = useState(false);
  const [iosInstructionsOpen, setIosInstructionsOpen] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as NavigatorWithStandalone).standalone === true;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setInstalled(standalone);
    setShowIosInstall(isIos && !standalone);

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowIosInstall(false);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" })
        .catch((error: unknown) => console.error("Could not register the VetKonnect service worker.", error));
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
    } catch (error) {
      console.error("Could not start the VetKonnect installation prompt.", error);
    }
  }

  if (installed) return null;

  return (
    <>
      {installPrompt ? (
        <button className="pwa-install" type="button" onClick={() => void install()}>Install VetKonnect POS</button>
      ) : null}
      {showIosInstall ? (
        <div className="pwa-ios-install">
          <button className="pwa-install" type="button" aria-expanded={iosInstructionsOpen} onClick={() => setIosInstructionsOpen((open) => !open)}>
            Install VetKonnect POS
          </button>
          {iosInstructionsOpen ? (
            <div className="pwa-ios-instructions">
              <button type="button" aria-label="Close install instructions" onClick={() => setIosInstructionsOpen(false)}>×</button>
              <strong>Add to Home Screen</strong>
              <span>In Safari, tap Share, then choose “Add to Home Screen”.</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
