import { NotificationSettingsForm } from "@/components/settings/settings-forms";
import { getSettingsData } from "@/lib/profile/settings-data";

export default async function NotificationSettingsPage() {
  const data = await getSettingsData();
  return (
    <>
      <p className="eyebrow">Preferences</p>
      <h2>Notifications</h2>
      <p className="settings-description">Choose the kinds of account updates you prefer.</p>
      <NotificationSettingsForm settings={data.settings} />
    </>
  );
}
