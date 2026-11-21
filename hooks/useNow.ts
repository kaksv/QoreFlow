"use client";

import { useEffect, useState } from "react";

/** One-second clock for client-side accrual. No RPC traffic per tick. */
export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return now;
}
