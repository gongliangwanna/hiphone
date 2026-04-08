export function HomeIndicator() {
  return (
    <div className="flex justify-center pb-2" data-testid="home-indicator">
      <div
        className="bg-white/60"
        style={{
          width: 134,
          height: 5,
          borderRadius: 'var(--radius-homeIndicator)',
        }}
      />
    </div>
  );
}
