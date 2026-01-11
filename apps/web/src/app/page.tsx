import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  // Redirect authenticated users to dashboard
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">Bee</h1>
      <p className="mt-2 text-muted-foreground">Your AI-powered personal knowledge management system</p>
      <div className="mt-6 flex gap-4">
        <Link
          href="/login"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-md border border-input px-4 py-2 hover:bg-accent"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}
