import { useState, useEffect } from 'react';

/** Returns current time as "HH:mm" string, updating every 10 seconds */
export function useClock(): string {
  const [time, setTime] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(formatTime(new Date()));
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  return time;
}

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
