import { requireProfileContext } from "@/lib/getProfile";
import { PageHeader } from "@/components/AppShell";
import { TestClient } from "./TestClient";

export const dynamic = "force-dynamic";

export default async function TestPage() {
  await requireProfileContext();
  return (
    <>
      <PageHeader
        title="Test a request"
        subtitle="See how StileAI checks an employee's AI request against your policy — approve, deny, or send for admin approval."
      />
      <TestClient />
    </>
  );
}
