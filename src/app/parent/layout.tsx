import RequireAuth from "@/components/RequireAuth";

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
