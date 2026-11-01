"use client";

import { loginWithPin } from "@/server/actions";
import { PinPad } from "./PinPad";

export function LoginScreen({ practiceCode, organizationName, logoUrl }: { practiceCode: string; organizationName: string; logoUrl?: string | null }) {
  return (
    <div className="login">
      <div className="login-card">
        <img className="logo clinic-login-logo" src={logoUrl || "/vetkonnect-logo.png"} alt={`${organizationName} logo`} />
        <h1 className="clinic-login-name">{organizationName}</h1>
        <p className="sub">VetKonnect P.O.S &amp; Management</p>
        <PinPad title="Enter your PIN" onSubmit={(pin) => loginWithPin(pin, practiceCode)} />
      </div>
    </div>
  );
}
