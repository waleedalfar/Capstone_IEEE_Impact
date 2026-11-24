import { PageTitle, Panel } from "@/components/ui";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Settings</PageTitle>
      <Panel>
        <div className="flex min-h-12 items-center justify-between gap-4">
          <span className="font-semibold text-navy">Dark mode</span>
          <ThemeSwitch />
        </div>
      </Panel>
    </div>
  );
}