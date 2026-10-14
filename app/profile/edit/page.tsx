import { Suspense } from "react";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { getProfileBundle } from "@/lib/profile/data";

const sections = [
  "basics",
  "photos",
  "about",
  "worldview",
  "family",
  "interests",
  "relationship",
  "visibility",
] as const;

async function EditProfileContent({
  searchParams,
}: {
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  const [{ section }, bundle] = await Promise.all([
    searchParams,
    getProfileBundle(),
  ]);
  const requestedSection = Array.isArray(section) ? section[0] : section;
  const initialSection = sections.find((item) => item === requestedSection) ?? "basics";

  return <ProfileEditor bundle={bundle} initialSection={initialSection} />;
}

export default function EditProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<main className="home-page"><p className="loading-note">Loading profile editor…</p></main>}>
      <EditProfileContent searchParams={searchParams} />
    </Suspense>
  );
}
