import { DiscoveryPreferencesForm } from "@/components/settings/settings-forms";
import { getSettingsData } from "@/lib/profile/settings-data";

export default async function PreferencesSettingsPage() {
  const data = await getSettingsData();
  return (
    <>
      <p className="eyebrow">Discovery</p>
      <h2>Preferences</h2>
      <p className="settings-description">Set the age, distance, and relationship preferences you may use for future discovery.</p>
      <DiscoveryPreferencesForm preferences={data.preferences} />
    </>
  );
}
