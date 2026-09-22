"use client";

import { SendHorizontal } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  dir = "rtl",
  placeholder = "اكتب إجابتك هنا...",
  sendLabel = "إرسال",
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  dir?: "rtl" | "ltr";
  placeholder?: string;
  sendLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "0px";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 140) + "px";
    }
  }, [value]);

  return (
    <div className="rounded-2xl border bg-white p-2 shadow-soft">
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          rows={1}
          dir={dir}
          placeholder={placeholder}
          className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 outline-none"
          disabled={disabled}
        />
        <Button size="icon" onClick={onSend} disabled={disabled || !value.trim()} aria-label={sendLabel}>
          <SendHorizontal size={18} />
        </Button>
      </div>
    </div>
  );
}
