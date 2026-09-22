"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { LoadingState } from "@/components/ui/feedback";
import type { Role } from "@/types";
export function RoleGuard({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && (!user || user.role !== role))
      router.replace("/auth/login");
  }, [loading, user, role, router]);
  if (loading || !user || user.role !== role)
    return <LoadingState label="جارٍ التحقق من الصلاحيات..." />;
  return children;
}
