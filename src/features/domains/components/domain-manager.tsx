"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { safely } from "@/features/profile/result";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addDomainAction, removeDomainAction, verifyDomainAction } from "../actions";
import { verificationRecordName } from "../host";

export type DomainRow = { id: string; hostname: string; status: string; verification_token: string; last_error: string | null };

const STATUS = {
  pending: { label: "Waiting for DNS", className: "bg-muted text-foreground" },
  failed: { label: "Not verified yet", className: "bg-amber-100 dark:bg-amber-950 text-amber-950 dark:text-amber-100" },
  verified: { label: "Ownership confirmed", className: "bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-100" },
  active: { label: "Connected", className: "bg-emerald-100 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-100" },
} as Record<string, { label: string; className: string }>;

function Record({ type, name, value }: { type: string; name: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-lg bg-muted p-3 text-xs sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,2fr)]">
      <span className="font-medium">{type}</span>
      <code className="break-all">{name}</code>
      <code className="break-all">{value}</code>
    </div>
  );
}

export function DomainManager({ domains }: { domains: DomainRow[] }) {
  const router = useRouter();
  const [hostname, setHostname] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(event: React.FormEvent) {
    event.preventDefault();
    setFieldError(undefined);
    setNotice(null);
    startTransition(async () => {
      const result = await safely(() => addDomainAction({ hostname }));
      if (result.ok) {
        setHostname("");
        router.refresh();
      } else {
        setFieldError(result.fieldErrors?.hostname ?? result.message);
      }
    });
  }

  return (
    <div className="grid gap-4">
      {notice ? <p role="status" className="rounded-lg border bg-card p-3 text-sm">{notice}</p> : null}

      {domains.map((domain) => {
        const status = STATUS[domain.status] ?? STATUS.pending;
        return (
          <Card key={domain.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 break-all">
                {domain.hostname}
                <span data-testid="domain-status" className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
              </CardTitle>
              {domain.last_error ? <CardDescription>{domain.last_error}</CardDescription> : null}
            </CardHeader>
            <CardContent className="grid gap-3">
              {domain.status !== "active" ? (
                <>
                  <p className="text-sm text-muted-foreground">Add these records where you manage your domain&apos;s DNS, then check again:</p>
                  <Record type="TXT" name={verificationRecordName(domain.hostname)} value={domain.verification_token} />
                  <Record type="CNAME" name={domain.hostname} value="cname.vercel-dns.com" />
                </>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {domain.status !== "active" ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await safely(() => verifyDomainAction(domain.id));
                        setNotice(result.message);
                        router.refresh();
                      })
                    }
                  >
                    Check now
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Remove ${domain.hostname}?`)) return;
                    startTransition(async () => {
                      const result = await safely(() => removeDomainAction(domain.id));
                      if (!result.ok) setNotice(result.message);
                      router.refresh();
                    });
                  }}
                >
                  Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>Add a domain</CardTitle>
          <CardDescription>A subdomain, like links.yourname.com, is the easiest to set up.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="grid gap-3" noValidate>
            <Field name="hostname" label="Domain" placeholder="links.yourname.com" value={hostname} onChange={(event) => setHostname(event.target.value)} error={fieldError} autoCapitalize="none" spellCheck={false} />
            <Button type="submit" variant="outline" className="justify-self-start" disabled={pending || !hostname.trim()}>Add domain</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
