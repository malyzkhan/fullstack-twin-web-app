import { PrivacySettingsForm } from "@/components/settings/settings-forms";
import { getSettingsData } from "@/lib/profile/settings-data";

export default async function PrivacySettingsPage() {
  const data = await getSettingsData();
  return (
    <>
      <p className="eyebrow">Privacy and safety</p>
      <h2>Your privacy</h2>
      <p className="settings-description">Control what other members can see and manage blocked accounts.</p>
      <PrivacySettingsForm
        blockedProfiles={data.blockedProfiles}
        discoverable={data.profile.is_discoverable}
        profileStatus={data.profile.profile_status}
        visibility={data.visibility}
      />
    </>
  );
}
