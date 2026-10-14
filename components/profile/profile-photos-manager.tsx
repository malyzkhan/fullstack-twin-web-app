"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  registerProfilePhoto,
  removeProfilePhoto,
  reorderProfilePhotos,
  setPrimaryPhoto,
} from "@/app/profile/edit/actions";
import type { ProfileBundle } from "@/lib/profile/types";

type Photo = ProfileBundle["photos"][number];

export function ProfilePhotosManager({ photos }: { photos: Photo[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function chooseFile(file?: File) {
    setMessage("");
    setError("");
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
    setSelectedFile(null);
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Choose an image smaller than 5 MB.");
      return;
    }

    void createImageBitmap(file).then((bitmap) => {
      const validDimensions =
        bitmap.width >= 300 &&
        bitmap.height >= 300 &&
        bitmap.width <= 8000 &&
        bitmap.height <= 8000;
      bitmap.close();
      if (!validDimensions) {
        setError("Use an image between 300×300 and 8000×8000 pixels.");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }).catch(() => {
      setError("We couldn’t read that image. Choose another file.");
    });
  }

  async function upload() {
    if (!selectedFile) return;
    setBusy(true);
    setMessage("");
    setError("");

    const client = createClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) {
      setError("Your session expired. Sign in again before uploading photos.");
      setBusy(false);
      return;
    }

    const extension = selectedFile.type === "image/jpeg"
      ? "jpg"
      : selectedFile.type === "image/png"
        ? "png"
        : "webp";
    const path = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await client.storage
      .from("profile-photos")
      .upload(path, selectedFile, {
        contentType: selectedFile.type,
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) {
      setError("We couldn’t upload that image. Check your connection and try again.");
      setBusy(false);
      return;
    }

    const result = await registerProfilePhoto(path);
    if (result.error) {
      const { error: cleanupError } = await client.storage
        .from("profile-photos")
        .remove([path]);
      setError(
        cleanupError
          ? `${result.error} The uploaded file also needs cleanup; contact support.`
          : result.error,
      );
      setBusy(false);
      return;
    }

    setSelectedFile(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
    setMessage("Photo added to your profile.");
    setBusy(false);
    router.refresh();
  }

  async function movePhoto(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= photos.length) return;
    const reordered = [...photos];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setBusy(true);
    setError("");
    const result = await reorderProfilePhotos(reordered.map((photo) => photo.id));
    if (result.error) setError(result.error);
    else router.refresh();
    setBusy(false);
  }

  async function choosePrimary(photoId: string) {
    setBusy(true);
    setError("");
    const result = await setPrimaryPhoto(photoId);
    if (result.error) setError(result.error);
    else router.refresh();
    setBusy(false);
  }

  async function deletePhoto(photoId: string) {
    if (!window.confirm("Remove this photo from your profile?")) return;
    setBusy(true);
    setError("");
    const result = await removeProfilePhoto(photoId);
    if (result.error) setError(result.error);
    else {
      setMessage("Photo removed.");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <section className="profile-editor-stack" aria-label="Manage profile photos">
      <p className="profile-field-help">
        JPG, PNG, or WebP · up to 5 MB · minimum 300×300 pixels. Photos are
        stored privately and shown only when profile visibility allows.
      </p>

      {photos.length ? (
        <div className="photo-manager-grid">
          {photos.map((photo, index) => (
            <article className="photo-manager-card" key={photo.id}>
              <div className="photo-manager-image">
                <Image
                  alt={photo.is_primary ? "Primary profile photo" : "Profile photo"}
                  fill
                  sizes="(max-width: 600px) 42vw, 220px"
                  src={photo.signedUrl}
                  unoptimized
                />
                {photo.is_primary ? <span className="primary-photo-label">Primary</span> : null}
              </div>
              <div className="photo-manager-actions">
                <button aria-label={`Move photo ${index + 1} earlier`} disabled={busy || index === 0} onClick={() => void movePhoto(index, -1)} type="button">↑</button>
                <button aria-label={`Move photo ${index + 1} later`} disabled={busy || index === photos.length - 1} onClick={() => void movePhoto(index, 1)} type="button">↓</button>
                {!photo.is_primary ? (
                  <button disabled={busy} onClick={() => void choosePrimary(photo.id)} type="button">Make primary</button>
                ) : null}
                <button className="photo-remove-button" disabled={busy} onClick={() => void deletePhoto(photo.id)} type="button">Remove</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="profile-photo-empty"><p>You haven’t added a profile photo yet.</p></div>
      )}

      <div className="photo-upload-box">
        <input
          accept="image/jpeg,image/png,image/webp"
          className="visually-hidden"
          onChange={(event) => chooseFile(event.target.files?.[0])}
          ref={inputRef}
          type="file"
        />
        <button className="button button-secondary" disabled={busy || photos.length >= 20} onClick={() => inputRef.current?.click()} type="button">
          Choose a photo
        </button>
        {previewUrl ? (
          <div className="photo-upload-preview">
            <Image alt="Preview of selected profile photo" height={180} src={previewUrl} unoptimized width={180} />
            <button className="button button-primary" disabled={busy} onClick={() => void upload()} type="button">
              {busy ? "Uploading photo…" : "Upload photo"}
            </button>
          </div>
        ) : null}
        {busy ? <p className="loading-note" role="status">Saving photo changes…</p> : null}
        {message ? <p className="form-message form-message-success" role="status">{message}</p> : null}
        {error ? <p className="form-message" role="alert">{error}</p> : null}
      </div>
    </section>
  );
}
