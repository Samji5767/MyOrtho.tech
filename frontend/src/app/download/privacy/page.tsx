import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "MyOrtho privacy policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      {/* Header */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-dl-border bg-dl-surface px-3 py-1 text-[11px] font-medium text-dl-muted mb-5">
          Legal
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-dl-text mb-3">
          Privacy Policy
        </h1>
        <p className="text-sm text-dl-muted">
          Effective date: July 4, 2026 &nbsp;·&nbsp; Last updated: July 4, 2026
        </p>
      </div>

      {/* Body */}
      <div className="prose prose-sm max-w-none text-dl-text [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-dl-text [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:text-dl-muted [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:text-dl-muted [&_ul]:pl-5 [&_ul]:mb-4 [&_li]:mb-1.5 [&_a]:text-dl-accent [&_a]:no-underline hover:[&_a]:underline">

        <p>
          MyOrtho Technologies, Inc. (&ldquo;MyOrtho&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) operates the MyOrtho
          clinical platform, including the web application at app.myortho.tech and the
          downloadable desktop applications for macOS and Windows. This Privacy Policy
          explains how we collect, use, disclose, and protect information when you use
          our services.
        </p>

        <h2>1. Scope</h2>
        <p>
          This policy applies to all users of the MyOrtho platform, including orthodontists,
          clinical staff, practice administrators, and enterprise organization administrators.
          It covers all personal data processed in connection with our services, whether
          submitted by users directly or generated through use of the platform.
        </p>
        <p>
          If your organization has a Business Associate Agreement (BAA) with us, that
          agreement governs the treatment of Protected Health Information (PHI) as defined
          under HIPAA, and prevails over this policy where the two conflict.
        </p>

        <h2>2. Data We Collect</h2>
        <p>We collect the following categories of information:</p>
        <ul>
          <li>
            <strong className="text-dl-text">Account data:</strong> name, email address,
            job title, and organization affiliation when you register.
          </li>
          <li>
            <strong className="text-dl-text">Clinical data:</strong> patient records,
            dental scans (STL, CBCT, photographs), treatment plans, and clinical notes
            uploaded by you or your organization.
          </li>
          <li>
            <strong className="text-dl-text">Usage data:</strong> log data, IP addresses,
            browser type, pages visited, features used, and session duration.
          </li>
          <li>
            <strong className="text-dl-text">Device data:</strong> operating system,
            hardware identifiers, and app version when using the desktop application.
          </li>
          <li>
            <strong className="text-dl-text">Communications:</strong> support tickets,
            emails, and any other messages sent to us.
          </li>
        </ul>

        <h2>3. How We Use Your Data</h2>
        <p>We use the data we collect to:</p>
        <ul>
          <li>Provide, maintain, and improve the MyOrtho platform.</li>
          <li>Process clinical scans and generate AI-assisted treatment recommendations.</li>
          <li>Authenticate users and secure sessions.</li>
          <li>Send transactional notifications (password resets, case status updates).</li>
          <li>Generate aggregate, de-identified analytics to improve our AI models.</li>
          <li>Comply with legal obligations and respond to lawful government requests.</li>
        </ul>
        <p>
          We do not sell your personal data or patient data to third parties. We do not use
          patient data for advertising purposes.
        </p>

        <h2>4. Data Sharing</h2>
        <p>
          We share data with trusted service providers who process it on our behalf under
          strict confidentiality obligations. These include cloud infrastructure providers
          (Supabase, AWS), payment processors (Stripe), and error monitoring tools. A full
          sub-processor list is available on request.
        </p>

        <h2>5. Data Retention</h2>
        <p>
          We retain account and clinical data for as long as your account is active, plus
          a 90-day grace period after account termination to allow for data export. After
          that, data is permanently deleted. Audit logs are retained for 7 years to
          satisfy regulatory requirements.
        </p>

        <h2>6. Security</h2>
        <p>
          We implement technical and organizational measures including AES-256 encryption
          at rest, TLS 1.3 in transit, role-based access control, and comprehensive audit
          logging. We conduct regular penetration tests and maintain a security incident
          response plan.
        </p>

        <h2>7. Your Rights</h2>
        <p>
          Depending on your jurisdiction, you may have rights to access, correct, delete,
          or port your personal data. To exercise these rights, contact us at{" "}
          <a href="mailto:privacy@myortho.tech">privacy@myortho.tech</a>. We will respond
          within 30 days.
        </p>

        <h2>8. HIPAA</h2>
        <p>
          MyOrtho acts as a Business Associate under HIPAA when processing PHI on behalf of
          covered entities. We sign BAAs for all paid plans. Our HIPAA compliance documentation
          is available to enterprise customers on request.
        </p>

        <h2>9. International Transfers</h2>
        <p>
          Data is processed primarily in the United States. For EU customers, we rely on
          Standard Contractual Clauses (SCCs) approved by the European Commission for cross-
          border transfers. EU data residency options are available for Enterprise plans.
        </p>

        <h2>10. Changes to this Policy</h2>
        <p>
          We may update this policy from time to time. If we make material changes, we will
          notify you by email or by posting a notice in the platform at least 30 days before
          the changes take effect. Continued use after the effective date constitutes acceptance.
        </p>

        <h2>11. Contact</h2>
        <p>
          For privacy inquiries, contact our Data Protection team at{" "}
          <a href="mailto:privacy@myortho.tech">privacy@myortho.tech</a> or write to:
        </p>
        <p>
          MyOrtho Technologies, Inc.<br />
          Attn: Privacy Team<br />
          123 Clinical Way, Suite 400<br />
          San Francisco, CA 94105
        </p>
      </div>

      {/* Footer links */}
      <div className="mt-12 pt-6 border-t border-dl-border flex flex-wrap gap-4 text-xs text-dl-muted">
        <Link href="/download/terms" className="text-dl-accent hover:underline">
          Terms of Service
        </Link>
        <Link href="/download/support" className="hover:text-dl-text transition-colors">
          Contact Support
        </Link>
        <Link href="/download" className="hover:text-dl-text transition-colors">
          Download Center
        </Link>
      </div>
    </div>
  );
}
