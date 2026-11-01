export async function sendEscPos(target: string | null) {
  if (!target) {
    return { sent: false, reason: "ESC/POS is selected, but no printer address is set. The print dialog will be used." };
  }
  return {
    sent: false,
    reason: `Direct printing to ${target} is not attached on this server yet. The print dialog will be used.`,
  };
}
