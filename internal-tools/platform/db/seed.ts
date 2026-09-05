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

type KycFixture = {
  applicantName: string;
  country: string;
  documentType: string;
  riskFlags: string[];
  status: string;
  assignee?: string;
};

/** kyc-review fixtures. Applicants and document references are invented. */
const KYC_CASES: KycFixture[] = [
  { applicantName: "Amara Okafor", country: "NG", documentType: "passport", riskFlags: ["pep_match"], status: "pending" },
  { applicantName: "Bruno Almeida", country: "BR", documentType: "national_id", riskFlags: [], status: "pending" },
  { applicantName: "Chen Wei", country: "SG", documentType: "passport", riskFlags: ["address_mismatch"], status: "pending" },
  { applicantName: "Diana Novak", country: "DE", documentType: "drivers_license", riskFlags: [], status: "pending" },
  { applicantName: "Elena Ruiz", country: "ES", documentType: "national_id", riskFlags: ["document_expired", "address_mismatch"], status: "pending" },
  { applicantName: "Femi Adeyemi", country: "NG", documentType: "drivers_license", riskFlags: ["sanctions_hit", "pep_match", "address_mismatch"], status: "pending" },
  { applicantName: "Grace Whitfield", country: "GB", documentType: "passport", riskFlags: [], status: "pending" },
  { applicantName: "Hugo Marques", country: "PT", documentType: "national_id", riskFlags: ["name_mismatch"], status: "pending" },
  { applicantName: "Ines Baptista", country: "PT", documentType: "passport", riskFlags: [], status: "pending" },
  { applicantName: "Jonas Keller", country: "DE", documentType: "national_id", riskFlags: ["address_mismatch"], status: "pending" },
  { applicantName: "Katia Sorensen", country: "US", documentType: "drivers_license", riskFlags: ["device_reuse", "address_mismatch"], status: "pending" },
  { applicantName: "Liam O'Donnell", country: "GB", documentType: "drivers_license", riskFlags: [], status: "pending" },
  { applicantName: "Mariana Costa", country: "BR", documentType: "passport", riskFlags: ["pep_match", "name_mismatch"], status: "pending" },
  { applicantName: "Noah Fischer", country: "DE", documentType: "passport", riskFlags: [], status: "pending" },
  { applicantName: "Olivia Tan", country: "SG", documentType: "national_id", riskFlags: ["document_expired"], status: "pending" },
  { applicantName: "Pablo Herrera", country: "ES", documentType: "passport", riskFlags: ["sanctions_hit"], status: "pending" },
  { applicantName: "Quinn Barnes", country: "US", documentType: "passport", riskFlags: ["address_mismatch"], status: "in_review", assignee: "kai@example.com" },
  { applicantName: "Rita Delgado", country: "ES", documentType: "drivers_license", riskFlags: [], status: "in_review", assignee: "kai@example.com" },
  { applicantName: "Samuel Adeniyi", country: "NG", documentType: "national_id", riskFlags: ["pep_match", "device_reuse"], status: "in_review", assignee: "kai@example.com" },
  { applicantName: "Tomas Rivera", country: "US", documentType: "national_id", riskFlags: ["name_mismatch"], status: "info_requested", assignee: "kai@example.com" },
];

function emailFor(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@applicants.example.com`;
}

async function seedKycCases() {
  const assignees = new Map(
    (await rawDb.user.findMany()).map((user) => [user.email, user] as const),
  );

  for (const [index, fixture] of KYC_CASES.entries()) {
    const assignee = fixture.assignee ? assignees.get(fixture.assignee) : undefined;
    const applicantEmail = emailFor(fixture.applicantName);
    const data = {
      applicantName: fixture.applicantName,
      applicantEmail,
      country: fixture.country,
      documentType: fixture.documentType,
      documentRef: `DOC-${String(index + 1).padStart(4, "0")}`,
      riskFlags: fixture.riskFlags,
      status: fixture.status,
      assigneeId: assignee?.id ?? null,
      assigneeName: assignee?.name ?? null,
    };

    const existing = await rawDb.kycCase.findFirst({ where: { applicantEmail } });
    if (existing) {
      await rawDb.kycCase.update({ where: { id: existing.id }, data });
    } else {
      await rawDb.kycCase.create({ data });
    }
  }

  console.log(`Seeded ${KYC_CASES.length} KYC cases.`);
}

async function main() {
  for (const user of USERS) {
    await rawDb.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role },
      create: user,
    });
  }
  console.log(`Seeded ${USERS.length} users.`);

  await seedKycCases();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await rawDb.$disconnect();
  });
