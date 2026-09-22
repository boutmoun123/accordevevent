import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "./button";

export function LoadingState({
  label = "Loading...",
}: {
  label?: string;
}) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-3 text-slate-500">
      <LoaderCircle className="animate-spin" size={20} />
      {label}
    </div>
  );
}

export function EmptyState({
  title = "No data",
  description = "Items will appear here when they are added.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed bg-slate-50/60 p-8 text-center">
      <Inbox className="mb-3 text-slate-400" />
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

export function ErrorState({
  message,
  retry,
  retryLabel = "Try again",
}: {
  message: string;
  retry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl bg-red-50 p-6 text-center text-red-700">
      <AlertCircle className="mb-2" />
      <p>{message}</p>
      {retry && (
        <Button variant="outline" className="mt-4" onClick={retry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
