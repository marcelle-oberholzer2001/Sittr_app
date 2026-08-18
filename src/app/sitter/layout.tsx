import RequireAuth from "@/components/RequireAuth";

export default function SitterLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
