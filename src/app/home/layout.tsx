import RequireAuth from "@/components/RequireAuth";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
