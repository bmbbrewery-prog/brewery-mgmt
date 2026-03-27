import { Suspense } from "react";
import AppLayout from "@/components/AppLayout";
import ScheduleGrid from "@/components/ScheduleGrid";

export default function Home() {
  return (
    <AppLayout>
      <div className="flex flex-col h-full gap-6">
        <section className="flex-grow min-h-0">
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
            <ScheduleGrid />
          </Suspense>
        </section>
      </div>
    </AppLayout>
  );
}
