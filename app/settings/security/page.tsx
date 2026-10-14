import { SecuritySettingsForm } from "@/components/settings/settings-forms";
import { getSettingsData } from "@/lib/profile/settings-data";

export default async function SecuritySettingsPage() {
  const data = await getSettingsData();
  return (
    <>
      <p className="eyebrow">Sign-in and access</p>
      <h2>Security</h2>
      <p className="settings-description">Manage how you sign in to Twin.</p>
      <SecuritySettingsForm email={data.user.email} provider={data.user.provider} />
    </>
  );
}
