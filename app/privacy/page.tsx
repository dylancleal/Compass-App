import { APP_VARIANT } from "@/lib/appVariant";
import PublicPageShell from "@/components/PublicPageShell";

export default function PrivacyPage() {
  const name = APP_VARIANT.name;
  const isStudy = APP_VARIANT.id === "study";
  return (
    <PublicPageShell>
    <div className="space-y-8 pb-16">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Privacy Policy</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Last updated: August 2026
        </p>
      </header>

      <Section title={`What ${name} is`}>
        <P>
          {name} is a personal life dashboard that helps you plan your day, track your goals,
          and stay on top of what matters — study, fitness, finances, and more. It is built for
          individual personal use.
        </P>
      </Section>

      <Section title="What data we collect">
        <P>We collect only what you actively provide or connect:</P>
        <ul className="mt-2 space-y-1.5 text-sm" style={{ color: "var(--muted)" }}>
          {[
            "Your email address — used only for sign-in via magic link",
            "Tasks, sessions, check-ins, and goals you create inside the app",
            "Calendar events from calendars you choose to connect (read-only)",
            "App settings and preferences you configure",
            "If you turn on notifications, a device/browser push token and your timezone — used only to time reminders",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span style={{ color: "var(--primary)" }}>·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Google Calendar data">
        <P>
          If you connect Google Calendar, {name} requests <strong>read-only</strong> access to
          your calendar events. We use this access solely to:
        </P>
        <ul className="mt-2 space-y-1.5 text-sm" style={{ color: "var(--muted)" }}>
          {[
            `Display your events in your ${name} calendar view`,
            "Detect scheduling conflicts between events",
            "Avoid suggesting activities that are already in your schedule",
            "Surface deadline-like events (assignments, exams) as task reminders",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span style={{ color: "var(--primary)" }}>·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <P className="mt-3">
          We do <strong>not</strong> modify, delete, or create events in your Google Calendar.
          We do not share your calendar data with any third party. Calendar event data is stored
          only in your personal {name} account database and is not used for advertising,
          analytics, or any purpose beyond the features described above.
        </P>
        <P>
          Your Google OAuth token is encrypted at rest. You can revoke {name}&apos;s access to
          your Google Calendar at any time from your{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: "var(--primary)" }}
          >
            Google account permissions page
          </a>
          , or by removing the connection inside {name}.
        </P>
      </Section>

      {isStudy && (
        <Section title="AI Coach">
          <P>
            {name} includes an AI coach feature that answers questions about your progress. When you use it, we send your <strong>aggregated activity stats</strong> — streaks, session counts, best weeks/months by area — and, if you ask a question, the text of that question, to Anthropic&apos;s Claude API to generate a response. We do not send your name, email, or raw calendar data to Anthropic. Anthropic processes this data to generate the response and does not use it to train their models. This feature is entirely optional — {name} works fully without ever using it.
          </P>
        </Section>
      )}

      {isStudy && (
        <Section title="Subscription and billing">
          <P>
            {name} offers a paid subscription. Payment is processed by{" "}
            <strong>Stripe</strong> (web) or through <strong>Google Play Billing</strong> via{" "}
            <strong>RevenueCat</strong> (Android app) — we never see or store your full card
            details ourselves. These processors receive the billing information necessary to
            charge you (such as your email and payment method) under their own privacy policies.
            We store only your subscription status and renewal date to determine your access
            level within {name}.
          </P>
        </Section>
      )}

      <Section title="How we use your data">
        <P>Your data is used exclusively to make {name} work for you:</P>
        <ul className="mt-2 space-y-1.5 text-sm" style={{ color: "var(--muted)" }}>
          {[
            "Generating your personalised daily plan based on your check-in, tasks, and schedule",
            "Tracking progress towards your weekly goals across life areas",
            "Identifying scheduling conflicts in your connected calendars",
            "Suggesting session types based on your past activity and stated goals",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span style={{ color: "var(--primary)" }}>·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <P>
          We do not use your data for advertising. We do not sell your data. We do not share your
          data with third parties except as technically necessary to operate the service —
          Supabase for database hosting, Vercel for app hosting
          {isStudy && ", and (only if you use those specific features) Anthropic for the AI coach and Stripe/RevenueCat for billing"}
          , each under their own privacy policies.
        </P>
      </Section>

      <Section title="Data storage and security">
        <P>
          Your data is stored in a Supabase PostgreSQL database with row-level security enabled,
          meaning your data is isolated from other users at the database level. All data is
          transmitted over HTTPS. OAuth tokens are encrypted before storage.
        </P>
        <P>
          The app is hosted on Vercel. Neither Vercel nor Supabase have access to your personal
          {" "}{name} data beyond what is technically required to host and operate the service.
        </P>
      </Section>

      <Section title="Your rights">
        <P>You can at any time:</P>
        <ul className="mt-2 space-y-1.5 text-sm" style={{ color: "var(--muted)" }}>
          {[
            "Export or review the data you have created in the app",
            "Delete your account and all associated data by contacting us",
            "Revoke calendar access without deleting your account",
            "Disconnect any connected calendar from within the app",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span style={{ color: "var(--primary)" }}>·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Contact">
        <P>
          Questions about this policy or requests to delete your data:{" "}
          <a
            href={`mailto:${APP_VARIANT.supportEmail}`}
            className="underline"
            style={{ color: "var(--primary)" }}
          >
            {APP_VARIANT.supportEmail}
          </a>
          . See also our{" "}
          <a href="/terms" className="underline" style={{ color: "var(--primary)" }}>
            Terms of Service
          </a>
          .
        </P>
      </Section>
    </div>
    </PublicPageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-sm leading-relaxed ${className}`} style={{ color: "var(--muted)" }}>
      {children}
    </p>
  );
}
