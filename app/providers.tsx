"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import ServiceWorker from "@/components/ServiceWorker";
import AuthGate from "@/components/AuthGate";

// Calls ensureSeeded only after auth is confirmed (AuthGate renders this as
// a child, so it never mounts on the login screen or while loading).
function SeedOnMount() {
  useEffect(() => {
    db.ensureSeeded();
  }, []);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ServiceWorker />
      <AuthGate>
        <SeedOnMount />
        {children}
      </AuthGate>
    </QueryClientProvider>
  );
}
