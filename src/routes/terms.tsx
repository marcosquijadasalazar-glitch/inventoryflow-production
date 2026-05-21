import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — InventoryFlow" },
      {
        name: "description",
        content:
          "Terms & Conditions governing the use of InventoryFlow, operated by SamVic Technologies.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      intro={
        <>
          <p>
            These Terms & Conditions (“Terms”) govern the use of InventoryFlow, operated by
            SamVic Technologies (“Company”, “we”, “our”, or “us”), accessible through{" "}
            <a
              href="https://inventoryflowapp.com"
              className="text-primary hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              https://inventoryflowapp.com
            </a>
            .
          </p>
          <p className="mt-3">
            By accessing or using InventoryFlow, you agree to be bound by these Terms.
          </p>
        </>
      }
      sections={[
        {
          heading: "Services",
          body: "InventoryFlow provides inventory management, operational tracking, barcode workflows, purchase order management, sales order workflows, internal inventory usage tracking, reporting, and related operational tools for businesses.",
          groups: [
            {
              intro: "Services may include:",
              bullets: [
                "Software access",
                "Inventory management tools",
                "Operational workflows",
                "Administrative dashboards",
                "Reporting and export tools",
                "Barcode and scanning utilities",
                "Setup and onboarding services",
                "Technical support",
              ],
            },
          ],
        },
        {
          heading: "Account Access",
          body: "Access to InventoryFlow is granted only to approved organizations and authorized users.",
          groups: [
            {
              intro: "We reserve the right to:",
              bullets: [
                "approve or reject applications",
                "suspend accounts",
                "terminate access",
                "limit functionality",
                "restrict usage, at our sole discretion.",
              ],
              outro: "Users are responsible for maintaining the confidentiality of their credentials.",
            },
          ],
        },
        {
          heading: "Subscription & Payments",
          groups: [
            {
              intro: "InventoryFlow may operate under:",
              bullets: ["setup fees", "recurring monthly service fees", "customized service agreements", "enterprise pricing"],
            },
            {
              intro: "Failure to pay may result in:",
              bullets: ["suspension", "restricted access", "account termination", "data access limitations"],
            },
          ],
        },
        {
          heading: "Acceptable Use",
          groups: [
            {
              intro: "Users agree NOT to:",
              bullets: [
                "abuse the platform",
                "attempt unauthorized access",
                "interfere with system operations",
                "upload malicious code",
                "misuse inventory or reporting systems",
                "resell or redistribute the platform without authorization",
              ],
            },
          ],
        },
        {
          heading: "Data & Ownership",
          body: "Customers retain ownership of their business data entered into InventoryFlow.",
          groups: [
            {
              intro: "SamVic Technologies retains ownership of:",
              bullets: [
                "software",
                "code",
                "workflows",
                "branding",
                "system architecture",
                "proprietary operational methodologies",
              ],
            },
          ],
        },
        {
          heading: "Availability",
          body: "We aim to provide reliable service but do not guarantee uninterrupted availability.",
          groups: [
            {
              intro: "InventoryFlow may experience:",
              bullets: ["maintenance", "downtime", "updates", "third-party service interruptions"],
            },
          ],
        },
        {
          heading: "“AS IS” Disclaimer",
          body: "InventoryFlow is provided “AS IS” and “AS AVAILABLE” without warranties of any kind.",
          groups: [
            {
              intro: "SamVic Technologies does not guarantee:",
              bullets: [
                "uninterrupted operation",
                "complete accuracy",
                "error-free performance",
                "prevention of inventory discrepancies",
                "uninterrupted third-party integrations",
              ],
              outro:
                "Users remain responsible for validating inventory, accounting, operational, and business decisions.",
            },
          ],
        },
        {
          heading: "Limitation of Liability",
          groups: [
            {
              intro: "To the maximum extent permitted by law, SamVic Technologies shall not be liable for:",
              bullets: [
                "indirect damages",
                "lost profits",
                "operational losses",
                "inventory discrepancies",
                "data loss",
                "downtime",
                "business interruption",
                "consequential damages",
              ],
            },
          ],
        },
        {
          heading: "Suspension & Termination",
          groups: [
            {
              intro: "We reserve the right to suspend or terminate services for:",
              bullets: [
                "non-payment",
                "abuse",
                "security risks",
                "unauthorized use",
                "violation of these Terms",
              ],
              outro: "Terminated accounts may lose access to platform functionality.",
            },
          ],
        },
        {
          heading: "Modifications",
          body: "We may modify these Terms at any time. Continued use of InventoryFlow constitutes acceptance of updated Terms.",
        },
        {
          heading: "Governing Law",
          body: "These Terms shall be governed by the laws applicable in the State of Tennessee, United States, unless otherwise required by law.",
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
