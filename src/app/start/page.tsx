import { AppMain, AppPageShell } from "@/components/AppPageShell";
import { SiteHeader } from "@/components/SiteHeader";
import { CreationLauncher } from "@/components/CreationLauncher";

export default function StartPage() {
  return (
    <AppPageShell>
      <SiteHeader />
      <AppMain>
        <main className="mx-auto flex w-full max-w-5xl flex-col px-4 py-10 sm:px-6 sm:py-12 lg:px-10 lg:py-16">
          <CreationLauncher />
        </main>
      </AppMain>
    </AppPageShell>
  );
}
