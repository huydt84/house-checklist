export function localMode() {
  if (process.env.LOCAL_AUTH !== "true") return false;
  if (process.env.VERCEL || process.env.APP_ENV === "production")
    throw new Error("Local authentication is forbidden on hosted deployments");
  const u = new URL(
    process.env.LOCAL_POSTGRES_URI ||
      "postgresql://house:house_local@127.0.0.1:55433/house_local",
  );
  if (!["127.0.0.1", "localhost", "[::1]"].includes(u.hostname))
    throw new Error("Local database must be loopback");
  return true;
}
export function databaseUrl() {
  if (localMode())
    return (
      process.env.LOCAL_POSTGRES_URI ||
      "postgresql://house:house_local@127.0.0.1:55433/house_local"
    );
  if (!process.env.POSTGRES_URI) throw new Error("DATABASE_NOT_CONFIGURED");
  return process.env.POSTGRES_URI;
}
export const personas = Object.freeze({
  owner: {
    id: "10000000-0000-4000-8000-000000000001",
    email: "owner@house.local",
    name: "Local owner",
  },
  editor: {
    id: "10000000-0000-4000-8000-000000000002",
    email: "editor@house.local",
    name: "Local editor",
  },
  viewer: {
    id: "10000000-0000-4000-8000-000000000003",
    email: "viewer@house.local",
    name: "Local viewer",
  },
  outsider: {
    id: "10000000-0000-4000-8000-000000000004",
    email: "outsider@house.local",
    name: "Local outsider",
  },
});
