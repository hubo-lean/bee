import { Search } from "lucide-react";

export default function SearchPage() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <Search className="h-8 w-8 text-gray-400" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-gray-900">Search</h1>
      <p className="mt-2 text-sm text-gray-500">Coming soon</p>
      <p className="mt-1 text-xs text-gray-400">
        Find anything in your knowledge base
      </p>
    </div>
  );
}
