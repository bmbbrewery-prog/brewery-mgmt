import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "./prisma";

/**
 * Gets the current organization ID and ensures it exists in the local database.
 * If the user is not logged in or has no active organization, returns null.
 */
export async function getOrgAuth() {
  const authObj = await auth();
  const { userId, orgId, orgRole, orgSlug } = authObj;

  if (!userId || !orgId) {
    return null;
  }

  // Just-in-time synchronization of the organization
  // For simplicity, we use the ID from Clerk and a placeholder name if it doesn't exist.
  // In a production app, you might use webhooks to keep the name in sync.
  await prisma.organization.upsert({
    where: { id: orgId },
    update: {},
    create: {
      id: orgId,
      name: orgSlug || "My Brewery",
    },
  });

  // Ensure user exists too
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: "", // We can fetch email from currentUser() if needed, but ID is enough for relation
    },
  });

  // Ensure membership exists
  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId,
        organizationId: orgId,
      },
    },
    update: { role: orgRole || "member" },
    create: {
      userId,
      organizationId: orgId,
      role: orgRole || "member",
    },
  });

  return orgId;
}
