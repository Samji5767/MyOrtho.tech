import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "MyOrtho Terms of Service — the agreement governing use of the MyOrtho platform.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      {/* Header */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-dl-border bg-dl-surface px-3 py-1 text-[11px] font-medium text-dl-muted mb-5">
          Legal
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-dl-text mb-3">
          Terms of Service
        </h1>
        <p className="text-sm text-dl-muted">
          Effective date: July 4, 2026 &nbsp;·&nbsp; Last updated: July 4, 2026
        </p>
      </div>

      {/* Body */}
      <div className="prose prose-sm max-w-none text-dl-text [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-dl-text [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:text-dl-muted [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:text-dl-muted [&_ul]:pl-5 [&_ul]:mb-4 [&_li]:mb-1.5 [&_a]:text-dl-accent [&_a]:no-underline hover:[&_a]:underline [&_strong]:text-dl-text">

        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) constitute a binding legal agreement between
          you (or the organization you represent) and MyOrtho Technologies, Inc.
          (&ldquo;MyOrtho&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) governing your access to and use of the MyOrtho
          clinical platform, including the web application and desktop applications.
        </p>
        <p>
          By accessing or using the platform, you confirm that you have read, understood,
          and agree to be bound by these Terms and our{" "}
          <Link href="/download/privacy">Privacy Policy</Link>.
        </p>

        <h2>1. Eligibility</h2>
        <p>
          You must be at least 18 years old and authorized to enter contracts on behalf of
          the entity you represent. The platform is intended for licensed dental and
          orthodontic professionals. Use by unlicensed individuals for clinical purposes
          is prohibited.
        </p>

        <h2>2. Accounts</h2>
        <p>
          You are responsible for maintaining the confidentiality of your login credentials
          and for all activities that occur under your account. Notify us immediately at{" "}
          <a href="mailto:security@myortho.tech">security@myortho.tech</a> if you suspect
          unauthorized access. You may not share credentials or allow others to access the
          platform using your account.
        </p>

        <h2>3. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the platform for any unlawful purpose or in violation of applicable regulations.</li>
          <li>Upload patient data without obtaining all required consents under applicable law.</li>
          <li>Attempt to reverse engineer, decompile, or extract the source code of the platform.</li>
          <li>Use automated scripts or bots to access the platform without our prior written consent.</li>
          <li>Interfere with or disrupt the security or availability of the platform.</li>
          <li>Share your subscription with individuals outside your licensed organization.</li>
        </ul>

        <h2>4. Clinical Use Disclaimer</h2>
        <p>
          <strong>MyOrtho is a clinical decision-support tool, not a replacement for
          professional clinical judgment.</strong> AI-generated segmentation results,
          treatment recommendations, and simulation outputs must be reviewed and validated
          by a licensed orthodontist before use in patient care. MyOrtho does not diagnose,
          treat, or prescribe. You bear sole clinical and professional responsibility for
          all treatment decisions made using the platform.
        </p>

        <h2>5. Intellectual Property</h2>
        <p>
          MyOrtho and its licensors own all rights in the platform, including software,
          AI models, algorithms, and documentation. These Terms do not grant you any
          intellectual property rights in the platform beyond the limited license to use
          it as described herein.
        </p>
        <p>
          You retain ownership of all patient data, clinical records, and other content
          you upload. You grant us a limited, non-exclusive license to process that data
          solely to provide the services and as described in our Privacy Policy.
        </p>

        <h2>6. Subscription and Payment</h2>
        <p>
          Fees are charged as described on our pricing page. Subscriptions renew
          automatically unless cancelled before the renewal date. Refunds are not provided
          for partial billing periods unless required by applicable law. We reserve the
          right to change pricing with 30 days&apos; notice.
        </p>

        <h2>7. Termination</h2>
        <p>
          Either party may terminate this agreement at any time. We may suspend or
          terminate your access immediately if you violate these Terms or if we are
          required to do so by law. Upon termination, your right to access the platform
          ceases, subject to the data export rights described in our Privacy Policy.
        </p>

        <h2>8. Warranties and Disclaimers</h2>
        <p>
          THE PLATFORM IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF
          ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS
          FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
          PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
        </p>

        <h2>9. Limitation of Liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, MYORTHO AND ITS AFFILIATES,
          OFFICERS, AND EMPLOYEES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER
          INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER
          INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE PLATFORM.
        </p>
        <p>
          IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU EXCEED THE AMOUNTS PAID BY YOU TO
          US IN THE TWELVE MONTHS PRECEDING THE CLAIM.
        </p>

        <h2>10. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the State of California, without regard to
          conflict of law provisions. Any disputes shall be resolved by binding arbitration in
          San Francisco, California, except that either party may seek injunctive relief in court
          for intellectual property violations.
        </p>

        <h2>11. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. If we make material changes, we will
          notify you by email or in-app notice at least 30 days before they take effect.
          Continued use of the platform after the effective date constitutes acceptance of
          the revised Terms.
        </p>

        <h2>12. Contact</h2>
        <p>
          For legal inquiries, contact us at{" "}
          <a href="mailto:legal@myortho.tech">legal@myortho.tech</a>.
        </p>
      </div>

      {/* Footer links */}
      <div className="mt-12 pt-6 border-t border-dl-border flex flex-wrap gap-4 text-xs text-dl-muted">
        <Link href="/download/privacy" className="text-dl-accent hover:underline">
          Privacy Policy
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
