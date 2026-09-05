import { rawDb } from "./raw";

/**
 * Seeds demo data through `rawDb` so fixtures do not appear in the audit log.
 * Each app appends its own fixtures to this file.
 */
const USERS = [
  { name: "Vera Viewer", email: "vera@example.com", role: "viewer" },
  { name: "Kai Analyst", email: "kai@example.com", role: "kyc_analyst" },
  { name: "Lena Lead", email: "lena@example.com", role: "kyc_lead" },
  { name: "Farid Analyst", email: "farid@example.com", role: "fraud_analyst" },
  { name: "Freya Lead", email: "freya@example.com", role: "fraud_lead" },
  { name: "Ada Admin", email: "ada@example.com", role: "admin" },
];

async function main() {
  for (const user of USERS) {
    await rawDb.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role },
      create: user,
    });
  }
  console.log(`Seeded ${USERS.length} users.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await rawDb.$disconnect();
  });
