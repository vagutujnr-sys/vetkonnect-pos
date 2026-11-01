export function AudioSoon({ label = "Audio note" }: { label?: string }) {
  return (
    <button type="button" className="audio-soon" disabled>
      <span>{label}</span>
      <small>Coming soon</small>
    </button>
  );
}
