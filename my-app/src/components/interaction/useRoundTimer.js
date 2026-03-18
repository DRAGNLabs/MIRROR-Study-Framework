import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';

export function useRoundTimer() {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const timerIntervalRef = useRef(null);

  const startClientTimer = (endTime) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        clearInterval(timerIntervalRef.current);
      }
    };

    updateTimer();
    timerIntervalRef.current = setInterval(updateTimer, 1000);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const clearTimer = () => {
    setTimeRemaining(null);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
  };

  useEffect(() => {
    socket.on("timer-start", ({ duration, endTime }) => {
      console.log(`Timer started: ${duration}ms`);
      startClientTimer(endTime);
    });

    socket.on("timer-expired", () => {
      console.log("Timer expired");
      clearTimer();
    });

    return () => {
      socket.off("timer-start");
      socket.off("timer-expired");
      clearTimer();
    };
  }, []);

  return {
    timeRemaining,
    formatTime,
    clearTimer
  };
}