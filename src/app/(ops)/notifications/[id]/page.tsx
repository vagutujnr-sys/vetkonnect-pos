import { openNotification } from "@/server/actions";

export default async function OpenNotificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await openNotification(id);
}
