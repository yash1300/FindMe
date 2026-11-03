"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/features/media/components/image-upload";
import { changeUsernameAction, completeWizardAction, saveThemeAction, updateProfileDetailsAction } from "@/features/profile/actions";
import { CREATOR_CATEGORIES } from "@/features/profile/categories";
import { PreviewFrame } from "@/features/profile/components/preview-frame";
import type { OwnerBlock, OwnerSocialLink } from "@/features/profile/queries";
import { toViewData } from "@/features/profile/to-view-data";
import { SocialManager } from "@/features/social/components/social-manager";
import { PresetPicker } from "@/features/themes/components/theme-controls";
import { THEME_PRESETS } from "@/features/themes/presets";
import type { Theme } from "@/features/themes/schema";
import { UsernameField } from "@/features/usernames/components/username-field";

type Props = {
  baseUrl: string;
  profile: {
    username: string;
    display_name: string;
    bio: string | null;
    category: string | null;
    avatar_path: string | null;
    cover_path: string | null;
    is_indexable: boolean;
    version: number;
  };
  theme: Theme;
  blocks: OwnerBlock[];
  socialLinks: OwnerSocialLink[];
};

const STEPS = [
  { id: "welcome", title: "Welcome to FindMe", optional: false },
  { id: "username", title: "Choose your username", optional: false },
  { id: "photo", title: "Add a profile picture", optional: true },
  { id: "name", title: "What should we call you?", optional: false },
  { id: "bio", title: "Write a short bio", optional: true },
  { id: "category", title: "What best describes you?", optional: true },
  { id: "social", title: "Add your social links", optional: true },
  { id: "theme", title: "Choose a theme", optional: true },
  { id: "preview", title: "Here's your page", optional: false },
  { id: "publish", title: "Ready to go live?", optional: false },
] as const;

export function OnboardingWizard({ baseUrl, profile, theme: initialTheme, blocks, socialLinks: initialLinks }: Props) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [category, setCategory] = useState(profile.category ?? "");
  const [avatarPath, setAvatarPath] = useState(profile.avatar_path);
  const [theme, setTheme] = useState(initialTheme);
  const [links, setLinks] = useState(initialLinks);
  const [version, setVersion] = useState(Number(profile.version));
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const step = STEPS[stepIndex];
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);
  const goTo = (index: number) => {
    setError(null);
    setFieldError(undefined);
    setStepIndex(index);
  };

  /** Each step saves before moving on, so leaving partway never loses what was entered. */
  async function saveStep(formUsername?: string): Promise<boolean> {
    if (step.id === "username" && formUsername !== undefined) {
      const result = await changeUsernameAction({ username: formUsername });
      if (!result.ok) {
        setFieldError(result.fieldErrors?.username ?? result.message);
        return false;
      }
      setUsername(result.username);
      setVersion(result.version);
      return true;
    }

    if (step.id === "theme") {
      const result = await saveThemeAction({ theme, expectedVersion: version });
      if (!result.ok) {
        setError(result.message);
        return false;
      }
      setVersion(result.version);
      return true;
    }

    if (["photo", "name", "bio", "category"].includes(step.id)) {
      const result = await updateProfileDetailsAction({
        displayName,
        bio,
        category,
        avatarPath,
        coverPath: profile.cover_path,
        isIndexable: profile.is_indexable,
        expectedVersion: version,
      });
      if (!result.ok) {
        const message = result.fieldErrors?.displayName ?? result.fieldErrors?.bio ?? result.message;
        setFieldError(message);
        setError(result.fieldErrors ? null : message);
        return false;
      }
      setVersion(result.version);
    }
    return true;
  }

  function next(formUsername?: string) {
    setError(null);
    setFieldError(undefined);
    startTransition(async () => {
      if (await saveStep(formUsername)) setStepIndex((index) => index + 1);
    });
  }

  function finish(publish: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await completeWizardAction({ publish });
      if (result.ok) router.push("/dashboard");
      else setError(result.message);
    });
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Step {stepIndex + 1} of {STEPS.length}</span>
          <button type="button" className="underline underline-offset-2 hover:text-foreground" disabled={pending} onClick={() => finish(false)}>Finish later</button>
        </div>
        <div role="progressbar" aria-label="Setup progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-brand-violet transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">{step.title}</h1>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {step.id === "welcome" ? (
        <p className="text-muted-foreground">
          In a few quick steps you&apos;ll have a page for all your links, content and socials. You can change everything later, and skip anything you&apos;re not ready for.
        </p>
      ) : null}

      {step.id === "username" ? (
        <form
          id="username-step"
          action={(formData) => next(String(formData.get("username") ?? ""))}
          className="grid gap-2"
        >
          <UsernameField key={username} baseUrl={baseUrl} defaultValue={username} skipCheckFor={username} error={fieldError} />
        </form>
      ) : null}

      {step.id === "photo" ? <ImageUpload label="Profile picture" value={avatarPath} onChange={setAvatarPath} /> : null}

      {step.id === "name" ? (
        <Field name="displayName" label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} error={fieldError} required />
      ) : null}

      {step.id === "bio" ? (
        <TextareaField id="bio" label="Bio" value={bio} maxLength={300} hint={`${bio.length}/300`} error={fieldError} onChange={(event) => setBio(event.target.value)} />
      ) : null}

      {step.id === "category" ? (
        <SelectField
          id="category"
          label="Category"
          value={category}
          options={[{ value: "", label: "Choose a category" }, ...CREATOR_CATEGORIES.map((value) => ({ value, label: value }))]}
          onChange={(event) => setCategory(event.target.value)}
        />
      ) : null}

      {step.id === "social" ? <SocialManager initialLinks={links} onChange={setLinks} /> : null}

      {step.id === "theme" ? <PresetPicker current={theme.preset} onChoose={(preset) => setTheme(THEME_PRESETS[preset])} /> : null}

      {step.id === "preview" || step.id === "theme" ? (
        <PreviewFrame
          data={toViewData({ username, display_name: displayName, bio, avatar_path: avatarPath, cover_path: profile.cover_path }, blocks, links, theme)}
        />
      ) : null}

      {step.id === "publish" ? (
        <div className="grid gap-3">
          <p className="text-muted-foreground">
            Publishing makes your page public at <span className="font-medium text-foreground">{baseUrl.replace(/^https?:\/\//, "")}/{username}</span>. You can add links first and publish whenever you like.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={pending} onClick={() => finish(true)}>Publish my page</Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => finish(false)}>Keep it as a draft</Button>
          </div>
        </div>
      ) : null}

      {step.id !== "publish" ? (
        <div className="flex flex-wrap items-center gap-2">
          {stepIndex > 0 ? <Button type="button" variant="ghost" disabled={pending} onClick={() => goTo(stepIndex - 1)}>Back</Button> : null}
          {step.id === "username" ? (
            <Button type="submit" form="username-step" disabled={pending}>{pending ? "Saving…" : "Continue"}</Button>
          ) : (
            <Button type="button" disabled={pending} onClick={() => next()}>{pending ? "Saving…" : stepIndex === 0 ? "Get started" : "Continue"}</Button>
          )}
          {step.optional ? <Button type="button" variant="ghost" disabled={pending} onClick={() => goTo(stepIndex + 1)}>Skip</Button> : null}
        </div>
      ) : (
        <Button type="button" variant="ghost" className="justify-self-start" disabled={pending} onClick={() => goTo(stepIndex - 1)}>Back</Button>
      )}
    </div>
  );
}
