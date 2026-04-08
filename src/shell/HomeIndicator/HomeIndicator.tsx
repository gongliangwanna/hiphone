export function HomeIndicator() {
  return (
    <div
      className="flex justify-center"
      style={{ paddingBottom: 'var(--home-indicator-bottom)' }}
      data-testid="home-indicator"
    >
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
