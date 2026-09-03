import { AppShell } from "../../components/app-shell";
import { AuthGuard } from "../../components/auth-guard";
import { RankingsPanel } from "../../components/rankings-panel";

export default function RankingsPage() {
  return (
    <AuthGuard>
      <AppShell>
        <RankingsPanel />
      </AppShell>
    </AuthGuard>
  );
}
