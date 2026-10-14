import Link from "next/link";
import { getSettingsData } from "@/lib/profile/settings-data";

export default async function ProfileSettingsPage() {
  const data = await getSettingsData();
  return (
    <>
      <p className="eyebrow">Profile</p>
      <h2>Profile settings</h2>
      <p className="settings-description">Edit your dating profile separately from your account identity.</p>
      <div className="settings-account-summary">
        <span>Profile name</span>
        <strong>{data.profile.display_name || "Name not set"}</strong>
        <small>Email and full date of birth are never shown on your public profile.</small>
      </div>
      <Link className="button button-primary" href="/profile/edit">Edit dating profile</Link>
      <Link className="settings-secondary-link" href="/profile">View my profile</Link>
    </>
  );
}
