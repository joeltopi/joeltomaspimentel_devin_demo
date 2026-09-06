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

type FraudFixture = {
  customerName: string;
  amount: number;
  merchant: string;
  destination: string;
  destinationKnown: boolean;
  channel: string;
  riskScore: number;
  riskReasons: string[];
  status: string;
  assignee?: string;
};

/**
 * fraud-review fixtures. Every row is one the hold rule caught: $1,000 or more
 * to a destination the customer has not paid before, or $10,000 or more to one
 * they have. Customers, merchants and destinations are invented.
 */
const FRAUD_TRANSACTIONS: FraudFixture[] = [
  { customerName: "Amara Okafor", amount: 1_240.5, merchant: "Northgate Electronics", destination: "Northgate Electronics", destinationKnown: false, channel: "card_not_present", riskScore: 52, riskReasons: ["new_device"], status: "held" },
  { customerName: "Bruno Almeida", amount: 1_875, merchant: "Vela Travel", destination: "Vela Travel", destinationKnown: false, channel: "card_not_present", riskScore: 44, riskReasons: ["geo_mismatch"], status: "held" },
  { customerName: "Chen Wei", amount: 2_310.75, merchant: "Harbour Freight Co", destination: "Harbour Freight Co", destinationKnown: false, channel: "transfer", riskScore: 61, riskReasons: ["velocity", "new_device"], status: "held" },
  { customerName: "Diana Novak", amount: 3_050, merchant: "Alto Furniture", destination: "Alto Furniture", destinationKnown: false, channel: "card_present", riskScore: 38, riskReasons: ["amount_anomaly"], status: "held" },
  { customerName: "Elena Ruiz", amount: 4_120.4, merchant: "Sable Jewellers", destination: "Sable Jewellers", destinationKnown: false, channel: "card_not_present", riskScore: 71, riskReasons: ["geo_mismatch", "amount_anomaly"], status: "held" },
  { customerName: "Femi Adeyemi", amount: 1_099.99, merchant: "Pixel Parts", destination: "Pixel Parts", destinationKnown: false, channel: "card_not_present", riskScore: 83, riskReasons: ["card_testing", "velocity", "new_device"], status: "held" },
  { customerName: "Grace Whitfield", amount: 1_640, merchant: "Lumen Supplies", destination: "Lumen Supplies", destinationKnown: false, channel: "transfer", riskScore: 35, riskReasons: ["new_device"], status: "held" },
  { customerName: "Hugo Marques", amount: 2_780.2, merchant: "Costa Auto", destination: "Costa Auto", destinationKnown: false, channel: "card_present", riskScore: 47, riskReasons: ["velocity"], status: "held" },
  { customerName: "Ines Baptista", amount: 5_400, merchant: "Atlas Watches", destination: "Atlas Watches", destinationKnown: false, channel: "card_not_present", riskScore: 66, riskReasons: ["amount_anomaly", "new_device"], status: "held" },
  { customerName: "Jonas Keller", amount: 7_950.6, merchant: "Rheinbau GmbH", destination: "Rheinbau GmbH", destinationKnown: false, channel: "transfer", riskScore: 58, riskReasons: ["geo_mismatch"], status: "held" },
  { customerName: "Katia Sorensen", amount: 9_999, merchant: "Fjord Interiors", destination: "Fjord Interiors", destinationKnown: false, channel: "transfer", riskScore: 74, riskReasons: ["amount_anomaly", "velocity"], status: "held" },
  { customerName: "Liam O'Donnell", amount: 12_500, merchant: "Shannon Motors", destination: "Shannon Motors", destinationKnown: true, channel: "transfer", riskScore: 69, riskReasons: ["amount_anomaly"], status: "held" },
  { customerName: "Mariana Costa", amount: 15_300.9, merchant: "Ipanema Imports", destination: "Ipanema Imports", destinationKnown: true, channel: "transfer", riskScore: 88, riskReasons: ["velocity", "geo_mismatch"], status: "held" },
  { customerName: "Noah Fischer", amount: 21_000, merchant: "Berlin Bau AG", destination: "Berlin Bau AG", destinationKnown: true, channel: "transfer", riskScore: 63, riskReasons: ["amount_anomaly"], status: "held" },
  { customerName: "Olivia Tan", amount: 25_000, merchant: "Marina Yachts", destination: "Marina Yachts", destinationKnown: false, channel: "transfer", riskScore: 91, riskReasons: ["new_device", "geo_mismatch", "amount_anomaly"], status: "held" },
  { customerName: "Pablo Herrera", amount: 33_400.25, merchant: "Iberia Metals", destination: "Iberia Metals", destinationKnown: true, channel: "transfer", riskScore: 79, riskReasons: ["velocity"], status: "held" },
  { customerName: "Quinn Barnes", amount: 48_000, merchant: "Sierra Property", destination: "Sierra Property", destinationKnown: true, channel: "transfer", riskScore: 98, riskReasons: ["amount_anomaly", "velocity", "geo_mismatch"], status: "held" },
  { customerName: "Rita Delgado", amount: 1_320, merchant: "Cielo Boutique", destination: "Cielo Boutique", destinationKnown: false, channel: "card_present", riskScore: 41, riskReasons: ["new_device"], status: "held" },
  { customerName: "Samuel Adeniyi", amount: 6_780, merchant: "Lagos Tech Hub", destination: "Lagos Tech Hub", destinationKnown: false, channel: "card_not_present", riskScore: 86, riskReasons: ["card_testing", "velocity"], status: "held" },
  { customerName: "Tomas Rivera", amount: 2_050.1, merchant: "Rivera Logistics", destination: "Rivera Logistics", destinationKnown: false, channel: "transfer", riskScore: 55, riskReasons: ["geo_mismatch"], status: "held" },
  { customerName: "Ulla Lindqvist", amount: 3_990, merchant: "Nord Outdoor", destination: "Nord Outdoor", destinationKnown: false, channel: "card_not_present", riskScore: 49, riskReasons: ["new_device"], status: "held" },
  { customerName: "Viktor Petrov", amount: 11_200, merchant: "Dunai Trading", destination: "Dunai Trading", destinationKnown: true, channel: "transfer", riskScore: 93, riskReasons: ["velocity", "card_testing"], status: "held" },
  { customerName: "Wanda Klein", amount: 1_450.65, merchant: "Klein Pharmacy", destination: "Klein Pharmacy", destinationKnown: false, channel: "card_present", riskScore: 37, riskReasons: ["amount_anomaly"], status: "held" },
  { customerName: "Xavier Dubois", amount: 8_640, merchant: "Provence Vins", destination: "Provence Vins", destinationKnown: false, channel: "card_not_present", riskScore: 72, riskReasons: ["geo_mismatch", "new_device"], status: "held" },
  { customerName: "Yara Haddad", amount: 4_800, merchant: "Cedar Textiles", destination: "Cedar Textiles", destinationKnown: false, channel: "transfer", riskScore: 64, riskReasons: ["velocity"], status: "held" },
  { customerName: "Zoe Castellanos", amount: 2_600, merchant: "Andes Coffee", destination: "Andes Coffee", destinationKnown: false, channel: "card_present", riskScore: 43, riskReasons: ["new_device"], status: "held" },
  { customerName: "Aiko Tanaka", amount: 18_750, merchant: "Kansai Robotics", destination: "Kansai Robotics", destinationKnown: true, channel: "transfer", riskScore: 81, riskReasons: ["amount_anomaly", "velocity"], status: "held" },
  { customerName: "Ben Carter", amount: 4_000, merchant: "Carter Studio Gear", destination: "Carter Studio Gear", destinationKnown: false, channel: "card_not_present", riskScore: 57, riskReasons: ["new_device"], status: "in_review", assignee: "farid@example.com" },
  { customerName: "Clara Moretti", amount: 6_240.3, merchant: "Milano Design", destination: "Milano Design", destinationKnown: false, channel: "card_not_present", riskScore: 68, riskReasons: ["geo_mismatch", "velocity"], status: "in_review", assignee: "farid@example.com" },
  { customerName: "Dmitri Volkov", amount: 9_100, merchant: "Volkov Freight", destination: "Volkov Freight", destinationKnown: false, channel: "transfer", riskScore: 77, riskReasons: ["amount_anomaly"], status: "in_review", assignee: "farid@example.com" },
  { customerName: "Wren Kavanagh", amount: 1_000, merchant: "Kavanagh Studio", destination: "Kavanagh Studio", destinationKnown: false, channel: "transfer", riskScore: 49, riskReasons: ["new_device"], status: "held" },
  { customerName: "Yusuf Demir", amount: 10_000, merchant: "Demir Machinery", destination: "Demir Machinery", destinationKnown: true, channel: "transfer", riskScore: 72, riskReasons: ["amount_anomaly"], status: "held" },
  { customerName: "Eve Nakamura", amount: 27_500, merchant: "Sakura Estates", destination: "Sakura Estates", destinationKnown: true, channel: "transfer", riskScore: 95, riskReasons: ["amount_anomaly", "geo_mismatch"], status: "pending_lead" },
];

const NEW_DESTINATION_HOLD = 1_000;
const HIGH_VALUE_HOLD = 10_000;

/** Mirrors `flagReasonFor` in the app; the seed may not import from `apps/`. */
function flagReasonFor(amount: number, destinationKnown: boolean): string {
  if (!destinationKnown && amount >= NEW_DESTINATION_HOLD) return "new_destination";
  if (amount >= HIGH_VALUE_HOLD) return "high_value";
  throw new Error(`Fixture of ${amount} to a known destination would not be held.`);
}

function customerIdFor(name: string): string {
  return `CUST-${name.toUpperCase().replace(/[^A-Z]+/g, "-")}`;
}

async function seedFraudTransactions() {
  const assignees = new Map(
    (await rawDb.user.findMany()).map((user) => [user.email, user] as const),
  );

  for (const fixture of FRAUD_TRANSACTIONS) {
    const assignee = fixture.assignee ? assignees.get(fixture.assignee) : undefined;
    const customerId = customerIdFor(fixture.customerName);
    const data = {
      customerId,
      customerName: fixture.customerName,
      amount: fixture.amount,
      currency: "USD",
      merchant: fixture.merchant,
      destination: fixture.destination,
      destinationKnown: fixture.destinationKnown,
      flagReason: flagReasonFor(fixture.amount, fixture.destinationKnown),
      channel: fixture.channel,
      riskScore: fixture.riskScore,
      riskReasons: fixture.riskReasons,
      status: fixture.status,
      assigneeId: assignee?.id ?? null,
      assigneeName: assignee?.name ?? null,
    };

    const existing = await rawDb.fraudHeldTransaction.findFirst({ where: { customerId } });
    if (existing) {
      await rawDb.fraudHeldTransaction.update({ where: { id: existing.id }, data });
    } else {
      await rawDb.fraudHeldTransaction.create({ data });
    }
  }

  console.log(`Seeded ${FRAUD_TRANSACTIONS.length} held transactions.`);
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
  await seedFraudTransactions();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await rawDb.$disconnect();
  });
