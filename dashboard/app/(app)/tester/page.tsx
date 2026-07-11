import { requireProfileContext } from "@/lib/getProfile";
import { PageHeader } from "@/components/AppShell";
import { TesterClient } from "./TesterClient";

export const dynamic = "force-dynamic";

export default async function TesterPage() {
  await requireProfileContext();
  return (
    <>
      <PageHeader
        title="Policy tester"
        subtitle="See exactly what your policy does with any prompt — a live check and a demo you can show prospects."
      />
      <TesterClient />
    </>
  );
}
