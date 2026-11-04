"use client";

import { ExternalLink } from "lucide-react";
import { useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { ImageUpload } from "@/features/media/components/image-upload";
import { UsernameField } from "@/features/usernames/components/username-field";
import { changeUsernameAction, setPublishStatusAction, updateProfileDetailsAction } from "../actions";
import { CREATOR_CATEGORIES } from "../categories";

type Status = "draft" | "published" | "unpublished" | "suspended";

const STATUS_COPY: Record<Status, { label: string; text: string; className: string }> = {
  draft: { label: "Draft", text: "Only you can see this page.", className: "bg-muted text-foreground" },
  published: { label: "Published", text: "Your page is live for everyone.", className: "bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-100" },
  unpublished: { label: "Unpublished", text: "Your page is hidden. Your content is kept safe.", className: "bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-100" },
  suspended: { label: "Suspended", text: "This page has been suspended by FindMe.", className: "bg-red-100 dark:bg-red-950 text-red-950 dark:text-red-100" },
};

export function PublishControls({ initialStatus, username, baseUrl }: { initialStatus: Status; username: string; baseUrl: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const copy = STATUS_COPY[status];

  function change(next: "published" | "unpublished") {
    setError(null);
    startTransition(async () => {
      const result = await setPublishStatusAction(next);
      if (result.ok) setStatus(result.status as Status);
      else setError(result.message);
    });
  }

  return (
    <div className="grid gap-3">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span data-testid="publish-status" className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${copy.className}`}>{copy.label}</span>
        <span className="text-muted-foreground">{copy.text}</span>
      </p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status !== "suspended" ? (
        <div className="flex flex-wrap gap-2">
          {status === "published" ? (
            <>
              <Button type="button" variant="outline" disabled={pending} onClick={() => change("unpublished")}>Unpublish</Button>
              <a href={`${baseUrl}/${username}`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "ghost" })}>
                View page <ExternalLink aria-hidden />
              </a>
            </>
          ) : (
            <Button type="button" disabled={pending} onClick={() => change("published")}>Publish page</Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function UsernameForm({ username, baseUrl }: { username: string; baseUrl: string }) {
  const [current, setCurrent] = useState(username);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await changeUsernameAction({ username: String(formData.get("username") ?? "") });
      if (result.ok) {
        setCurrent(result.username);
        setSaved(true);
      } else {
        setError(result.fieldErrors?.username ?? result.message);
      }
    });
  }

  return (
    <form action={submit} className="grid gap-3">
      <UsernameField key={current} baseUrl={baseUrl} defaultValue={current} error={error} skipCheckFor={current} />
      {saved ? <p role="status" className="text-sm text-emerald-800 dark:text-emerald-300">Username updated. Your new link is {baseUrl.replace(/^https?:\/\//, "")}/{current}.</p> : null}
      <p className="text-xs text-muted-foreground">
        Your old link stops working straight away. Your old name is held for you for 30 days, and you can change your username once a day.
      </p>
      <Button type="submit" variant="outline" className="justify-self-start" disabled={pending}>Change username</Button>
    </form>
  );
}

type DetailsProps = {
  initial: {
    displayName: string;
    bio: string | null;
    category: string | null;
    avatarPath: string | null;
    coverPath: string | null;
    isIndexable: boolean;
    analyticsEnabled: boolean;
    version: number;
  };
};

export function ProfileDetailsForm({ initial }: DetailsProps) {
  const [values, setValues] = useState({
    displayName: initial.displayName,
    bio: initial.bio ?? "",
    category: initial.category ?? "",
    avatarPath: initial.avatarPath,
    coverPath: initial.coverPath,
    isIndexable: initial.isIndexable,
    analyticsEnabled: initial.analyticsEnabled,
  });
  const [version, setVersion] = useState(initial.version);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "ok" | "error" | "conflict"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setMessage(null);
    startTransition(async () => {
      const result = await updateProfileDetailsAction({ ...values, expectedVersion: version });
      if (result.ok) {
        setVersion(result.version);
        setMessage({ type: "ok", text: "Saved." });
        return;
      }
      setErrors(result.fieldErrors ?? {});
      setMessage({ type: result.code === "conflict" ? "conflict" : "error", text: result.message });
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <ImageUpload label="Profile picture" value={values.avatarPath} onChange={(avatarPath) => setValues((v) => ({ ...v, avatarPath }))} />
      <ImageUpload label="Cover image" value={values.coverPath} onChange={(coverPath) => setValues((v) => ({ ...v, coverPath }))} hint="A wide image shown across the top of your page." />
      <Field
        name="displayName"
        label="Display name"
        value={values.displayName}
        onChange={(event) => setValues((v) => ({ ...v, displayName: event.target.value }))}
        error={errors.displayName}
        required
      />
      <TextareaField
        id="bio"
        label="Bio"
        value={values.bio}
        maxLength={300}
        hint={`${values.bio.length}/300`}
        onChange={(event) => setValues((v) => ({ ...v, bio: event.target.value }))}
        error={errors.bio}
      />
      <SelectField
        id="category"
        label="Category"
        value={values.category}
        options={[{ value: "", label: "Choose a category" }, ...CREATOR_CATEGORIES.map((value) => ({ value, label: value }))]}
        onChange={(event) => setValues((v) => ({ ...v, category: event.target.value }))}
      />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={values.isIndexable} onChange={(event) => setValues((v) => ({ ...v, isIndexable: event.target.checked }))} className="mt-0.5 size-4 accent-brand-violet" />
        <span>
          <span className="font-medium">Allow search engines to list my page</span>
          <span className="block text-xs text-muted-foreground">Turning this off asks them not to, but it doesn&apos;t make the page private.</span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={values.analyticsEnabled} onChange={(event) => setValues((v) => ({ ...v, analyticsEnabled: event.target.checked }))} className="mt-0.5 size-4 accent-brand-violet" />
        <span>
          <span className="font-medium">Count visits to my page</span>
          <span className="block text-xs text-muted-foreground">Powers your Analytics page. Turning it off stops new visits being counted, and keeps your past totals.</span>
        </span>
      </label>
      {message ? (
        <p role={message.type === "ok" ? "status" : "alert"} className={`text-sm ${message.type === "ok" ? "text-emerald-800 dark:text-emerald-300" : "text-destructive"}`}>
          {message.text}
          {message.type === "conflict" ? (
            <>
              {" "}
              <button type="button" className="underline" onClick={() => window.location.reload()}>Reload</button>
            </>
          ) : null}
        </p>
      ) : null}
      <Button type="submit" className="justify-self-start" disabled={pending}>{pending ? "Saving…" : "Save details"}</Button>
    </form>
  );
}
