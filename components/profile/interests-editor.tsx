"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reorderInterests, saveInterests } from "@/app/profile/edit/actions";
import type { ProfileBundle } from "@/lib/profile/types";

type Interest = ProfileBundle["interests"][number];
type CatalogItem = ProfileBundle["interestCatalog"][number];

export function InterestsEditor({
  catalog,
  interests,
}: {
  catalog: CatalogItem[];
  interests: Interest[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState(
    interests.flatMap((interest) => interest.interest_id ?? []),
  );
  const [customNames, setCustomNames] = useState(
    interests.flatMap((interest) => interest.custom_name ?? []),
  );
  const [customInput, setCustomInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function toggleInterest(id: number) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
    setError("");
  }

  function addCustom() {
    const normalized = customInput.trim();
    if (!normalized || normalized.length > 40) {
      setError("Custom interests must be between 1 and 40 characters.");
      return;
    }
    if (customNames.some((name) => name.toLowerCase() === normalized.toLowerCase())) {
      setError("That custom interest is already on your list.");
      return;
    }
    if (selectedIds.length + customNames.length >= 20) {
      setError("You can choose up to 20 interests.");
      return;
    }
    setCustomNames((current) => [...current, normalized]);
    setCustomInput("");
    setError("");
  }

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    const result = await saveInterests(selectedIds, customNames);
    if (result.error) {
      setError(result.error);
    } else {
      setMessage("Interests saved.");
      router.refresh();
    }
    setBusy(false);
  }

  async function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= interests.length) return;
    const reordered = [...interests];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setBusy(true);
    const result = await reorderInterests(reordered.map((item) => item.id));
    if (result.error) setError(result.error);
    else {
      setMessage("Interest order saved.");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <section className="interest-editor" aria-labelledby="interests-heading">
      <div>
        <h3 id="interests-heading">Your interests</h3>
        <p className="profile-field-help">Choose topics and activities you enjoy. You can reorder them below.</p>
      </div>
      <div className="interest-choice-grid">
        {catalog.map((interest) => (
          <label className="interest-choice" key={interest.id}>
            <input
              checked={selectedIds.includes(interest.id)}
              disabled={busy}
              onChange={() => toggleInterest(interest.id)}
              type="checkbox"
            />
            <span>{interest.name}</span>
          </label>
        ))}
      </div>
      <div className="custom-interest-field">
        <label htmlFor="custom-interest">Add a custom interest</label>
        <div>
          <input id="custom-interest" maxLength={40} onChange={(event) => setCustomInput(event.target.value)} value={customInput} />
          <button className="button button-secondary" disabled={busy} onClick={addCustom} type="button">Add</button>
        </div>
      </div>
      {customNames.length ? (
        <ul className="custom-interest-list">
          {customNames.map((name) => (
            <li key={name}>
              {name}
              <button aria-label={`Remove ${name}`} disabled={busy} onClick={() => setCustomNames((current) => current.filter((item) => item !== name))} type="button">×</button>
            </li>
          ))}
        </ul>
      ) : null}
      <div>
        <h3>Saved order</h3>
        {interests.length ? (
          <ol className="interest-order-list">
            {interests.map((interest, index) => (
              <li key={interest.id}>
                <span>{interest.name}</span>
                <span>
                  <button aria-label={`Move ${interest.name} earlier`} disabled={busy || index === 0} onClick={() => void move(index, -1)} type="button">↑</button>
                  <button aria-label={`Move ${interest.name} later`} disabled={busy || index === interests.length - 1} onClick={() => void move(index, 1)} type="button">↓</button>
                </span>
              </li>
            ))}
          </ol>
        ) : <p className="profile-field-help">Your saved interests will appear here.</p>}
      </div>
      <button className="button button-primary" disabled={busy} onClick={() => void save()} type="button">
        {busy ? "Saving…" : "Save interests"}
      </button>
      {message ? <p className="form-message form-message-success" role="status">{message}</p> : null}
      {error ? <p className="form-message" role="alert">{error}</p> : null}
    </section>
  );
}
