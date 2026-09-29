"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
export function Modal({
  open,
  onOpenChange,
  title,
  children,
  wide = false,
  dir,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  dir?: "rtl" | "ltr";
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="farah-dialog-overlay fixed inset-0 z-50 bg-brand-navy/45 backdrop-blur-sm" />
        <Dialog.Content
          dir={dir}
          className={`farah-dialog-content fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[28px] border border-[#E6D7E0] bg-white p-6 shadow-[0_24px_70px_rgba(42,22,48,0.18)] outline-none ${wide ? "max-w-4xl" : "max-w-lg"}`}
        >
          <div className="mb-5 flex items-center justify-between gap-4">
            <Dialog.Title data-dialog-title className="text-start text-xl font-bold text-[#1F1630]">{title}</Dialog.Title>
            <Dialog.Close
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F3E6EC] text-[#8E3D6B] transition hover:bg-[#E8BDD0]"
              aria-label="إغلاق"
            >
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
