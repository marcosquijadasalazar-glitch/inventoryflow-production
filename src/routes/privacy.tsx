import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — InventoryFlow" },
      {
        name: "description",
        content:
          "How InventoryFlow, operated by SamVic Technologies, collects, uses, and protects your information.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          InventoryFlow, operated by SamVic Technologies, respects your privacy and is committed
          to protecting your information.
        </p>
      }
      sections={[
        {
          heading: "Information We Collect",
          groups: [
            {
              intro: "We may collect:",
              bullets: [
                "company information",
                "contact information",
                "login credentials",
                "inventory data",
                "operational records",
                "barcode data",
                "transaction history",
                "usage analytics",
                "support communications",
              ],
            },
          ],
        },
        {
          heading: "How We Use Information",
          groups: [
            {
              intro: "We use collected information to:",
              bullets: [
                "provide platform services",
                "manage accounts",
                "improve operations",
                "provide support",
                "generate reports",
                "maintain platform security",
                "communicate with users",
              ],
            },
          ],
        },
        {
          heading: "Third-Party Services",
          groups: [
            {
              intro: "InventoryFlow may use third-party providers including:",
              bullets: [
                "Supabase",
                "hosting providers",
                "email providers",
                "analytics tools",
                "storage providers",
              ],
              outro:
                "These providers may process information necessary to operate the platform.",
            },
          ],
        },
        {
          heading: "Security",
          body: "We implement reasonable technical and operational measures to protect data. However, no online system can guarantee absolute security.",
        },
        {
          heading: "Data Ownership",
          body: "Business customers retain ownership of operational data entered into InventoryFlow.",
        },
        {
          heading: "Cookies & Sessions",
          body: "InventoryFlow may use cookies, authentication sessions, and browser storage to maintain secure access and improve user experience.",
        },
        {
          heading: "Data Retention",
          groups: [
            {
              intro: "We may retain operational and audit records as necessary for:",
              bullets: ["compliance", "security", "operational continuity", "dispute resolution"],
            },
          ],
        },
        {
          heading: "Account Termination",
          body: "Upon account termination, certain data may remain archived for operational, security, backup, or legal purposes.",
        },
        {
          heading: "Policy Updates",
          body: "This Privacy Policy may be updated periodically.",
        },
        {
          heading: "Contact",
          body: (
            <>
              <p>SamVic Technologies</p>
              <p>
                Website:{" "}
                <a
                  href="https://inventoryflowapp.com"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  https://inventoryflowapp.com
                </a>
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
