"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import ServiceWorker from "@/components/ServiceWorker";
import AuthGate from "@/components/AuthGate";

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
      <AuthGate>{children}</AuthGate>
    </QueryClientProvider>
  );
}
