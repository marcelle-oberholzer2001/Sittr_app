import ClipboardClient from "./ClipboardClient";

export default async function ClipboardPage({
  params,
}: {
  params: Promise<{ parentId: string }>;
}) {
  const { parentId: petId } = await params;

  return <ClipboardClient petId={petId} />;
}
