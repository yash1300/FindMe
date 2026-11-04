import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireStaff } from "@/features/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Users" };

type Row = { id: string; display_name: string; status: string; created_at: string };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff();
  const q = (await searchParams).q?.trim().slice(0, 100) ?? "";
  const admin = createSupabaseAdminClient();

  let ids: string[] | null = null;
  if (q) {
    // Wildcards in the search box are treated as plain characters.
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const [byName, byUsername] = await Promise.all([
      admin.from("accounts").select("id").ilike("display_name", pattern).limit(50),
      admin.from("profiles").select("owner_id").ilike("username", pattern).limit(50),
    ]);
    const found = [...(byName.data ?? []).map((row) => row.id), ...(byUsername.data ?? []).map((row) => row.owner_id)];
    if (q.includes("@")) {
      const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      found.push(...(data?.users ?? []).filter((user) => user.email?.toLowerCase().includes(q.toLowerCase())).map((user) => user.id));
    }
    ids = [...new Set(found)];
  }

  const base = admin.from("accounts").select("id, display_name, status, created_at").order("created_at", { ascending: false }).limit(50);
  const { data, error } = await (ids ? base.in("id", ids) : base);
  if (error) throw new Error(`Could not load users: ${error.message}`);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      <form method="get" className="flex max-w-md gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Name, username or email" aria-label="Search users" />
        <Button type="submit" variant="outline">Search</Button>
      </form>
      {(data as Row[]).length === 0 ? <p className="text-sm text-muted-foreground">No users found.</p> : null}
      <ul className="grid gap-2">
        {(data as Row[]).map((row) => (
          <li key={row.id}>
            <Link href={`/admin/users/${row.id}`} prefetch={false}>
              <Card className="transition-colors hover:border-primary">
                <CardHeader>
                  <CardTitle className="text-sm">{row.display_name}</CardTitle>
                  <CardDescription>{row.status} · joined {new Date(row.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
