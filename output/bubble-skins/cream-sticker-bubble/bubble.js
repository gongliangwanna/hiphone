window.renderBubble = function renderBubble(ctx) {
  const root = document.getElementById('bubble');
  const content = document.getElementById('content');
  if (!root || !content) return;

  const text = String(ctx.text || '');
  const isMine = Boolean(ctx.isMine);
  const lengthClass = text.length > 120
    ? 'tall'
    : text.length > 56
      ? 'long'
      : text.length > 18
        ? 'medium'
        : 'short';

  document.body.className = isMine ? 'is-mine' : 'is-other';
  root.className = `bubble ${isMine ? 'mine' : 'other'} ${lengthClass}`;
  root.removeAttribute('style');
  content.textContent = text;
};

window.measureBubble = function measureBubble() {
  const root = document.getElementById('bubble');
  if (!root) return 0;
  const rect = root.getBoundingClientRect();
  const bodyStyle = window.getComputedStyle(document.body);
  const paddingBottom = parseFloat(bodyStyle.paddingBottom || '0') || 0;
  return Math.ceil(rect.bottom + paddingBottom);
};
