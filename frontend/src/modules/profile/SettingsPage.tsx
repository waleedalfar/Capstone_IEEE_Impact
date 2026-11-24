import { Panel, PageTitle } from "@/components/ui";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export default function SettingsPage() {
  return (
    <>
      <PageTitle>Settings</PageTitle>
      <Panel>
        <div className="flex min-h-12 items-center justify-between gap-4">
          <span className="font-semibold text-navy">Dark mode</span>
          <ThemeSwitch />
        </div>
      </Panel>
    </>
  );
}