import { LoadingSpinner } from "@/components/ui/loading";

export default function AuthLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
