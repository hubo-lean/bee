import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
        <FileQuestion className="h-10 w-10 text-gray-400" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-3xl font-bold text-gray-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-gray-500">
        Sorry, we couldn&apos;t find the page you&apos;re looking for. It might
        have been moved or deleted.
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Go to Dashboard</Link>
      </Button>
    </div>
  );
}
