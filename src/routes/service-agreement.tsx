import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/service-agreement")({
  head: () => ({
    meta: [
      { title: "Business Service Agreement — InventoryFlow" },
      {
        name: "description",
        content:
          "Business Service Agreement between SamVic Technologies and InventoryFlow client organizations.",
      },
    ],
  }),
  component: ServiceAgreementPage,
});

function ServiceAgreementPage() {
  return (
    <LegalPage
      title="Business Service Agreement"
      intro={
        <p>
          This Business Service Agreement (“Agreement”) is entered into between SamVic
          Technologies and the client organization (“Client”).
        </p>
      }
      sections={[
        {
          heading: "Services",
          groups: [
            {
              intro:
                "SamVic Technologies agrees to provide access and operational support for InventoryFlow, including:",
              bullets: [
                "inventory workflows",
                "operational setup",
                "barcode integration",
                "reporting",
                "onboarding",
                "user management",
                "operational assistance",
                "technical support",
              ],
            },
          ],
        },
        {
          heading: "Setup & Onboarding",
          groups: [
            {
              intro: "Client onboarding may include:",
              bullets: [
                "organization setup",
                "user creation",
                "workflow configuration",
                "barcode setup",
                "inventory structure assistance",
                "operational consultation",
              ],
              outro: "Setup fees may apply.",
            },
          ],
        },
        {
          heading: "Monthly Services",
          groups: [
            {
              intro: "Recurring services may include:",
              bullets: [
                "software access",
                "support",
                "maintenance",
                "operational guidance",
                "feature configuration",
                "platform updates",
              ],
            },
          ],
        },
        {
          heading: "Client Responsibilities",
          groups: [
            {
              intro: "Client agrees to:",
              bullets: [
                "provide accurate information",
                "maintain proper operational procedures",
                "verify inventory accuracy",
                "manage authorized users responsibly",
                "maintain internal backups when necessary",
              ],
            },
          ],
        },
        {
          heading: "Payment Terms",
          groups: [
            {
              intro: "Client agrees to pay:",
              bullets: [
                "setup fees",
                "recurring monthly fees",
                "additional agreed service charges",
              ],
            },
            {
              intro: "Late or missing payments may result in:",
              bullets: ["restricted functionality", "suspension", "termination"],
            },
          ],
        },
        {
          heading: "Support",
          groups: [
            {
              intro: "Support may be provided through:",
              bullets: ["email", "messaging", "phone", "operational guidance sessions"],
              outro: "Support scope depends on the selected service plan.",
            },
          ],
        },
        {
          heading: "Data & Confidentiality",
          body: "Client retains ownership of operational data entered into InventoryFlow. SamVic Technologies agrees to use reasonable measures to maintain confidentiality.",
        },
        {
          heading: "Service Availability",
          body: "While reasonable uptime efforts will be made, uninterrupted service is not guaranteed.",
        },
        {
          heading: "Limitation of Liability",
          body: "InventoryFlow is an operational assistance platform and is provided “AS IS”.",
          groups: [
            {
              intro: "SamVic Technologies shall not be responsible for:",
              bullets: [
                "inventory losses",
                "operational decisions",
                "accounting discrepancies",
                "indirect damages",
                "lost profits",
                "business interruption",
              ],
            },
          ],
        },
        {
          heading: "Suspension & Termination",
          groups: [
            {
              intro: "SamVic Technologies reserves the right to:",
              bullets: ["suspend accounts", "restrict services", "terminate agreements"],
            },
            {
              intro: "for:",
              bullets: [
                "non-payment",
                "misuse",
                "security concerns",
                "violations of platform policies",
              ],
            },
          ],
        },
        {
          heading: "Future Updates",
          body: "Features, workflows, and operational capabilities may evolve over time.",
        },
        {
          heading: "Governing Law",
          body: "This Agreement shall be governed under the applicable laws of the State of Tennessee, United States.",
        },
        {
          heading: "Acceptance",
          body: (
            <>
              <p>Use of InventoryFlow and payment for services constitutes acceptance of this Agreement.</p>
              <p className="mt-3">
                SamVic Technologies —{" "}
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
