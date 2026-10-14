import { AccountDeletionForm } from "@/components/settings/settings-forms";

export default function AccountSettingsPage() {
  return (
    <>
      <p className="eyebrow">Account</p>
      <h2>Account management</h2>
      <p className="settings-description">Your login identity and dating profile are separate; removing your account deletes both.</p>
      <section className="settings-subsection">
        <h3>Delete account</h3>
        <AccountDeletionForm />
      </section>
    </>
  );
}
