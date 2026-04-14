import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export function NetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[99] bg-amber-900/90 backdrop-blur-sm text-amber-200 text-xs text-center py-2 font-medium flex items-center justify-center gap-2">
      <WifiOff className="w-3.5 h-3.5" />
      Sem conexão — usando dados em cache
    </div>
  );
}
