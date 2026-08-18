import RequireAuth from "@/components/RequireAuth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
