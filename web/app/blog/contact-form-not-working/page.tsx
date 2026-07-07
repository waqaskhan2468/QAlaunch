import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { SiteNav } from '@/components/site/site-nav'
import { SiteFooter } from '@/components/site/site-footer'

export const metadata: Metadata = {
  title: 'Contact Form Not Working? Why Forms Fail Silently and How to Test Yours',
  description:
    'Most broken contact forms show visitors a success message while the submission vanishes. A QA engineer explains the five ways forms fail silently, why yours worked when you tested it, and the 5-minute test that actually proves it works.',
  openGraph: {
    title: 'Contact Form Not Working? Why Forms Fail Silently and How to Test Yours',
    description:
      'The five ways contact forms fail without showing an error, why they pass the owner’s test and fail for real visitors, and how to test yours properly in five minutes.',
    url: 'https://getqalaunch.com/blog/contact-form-not-working',
    type: 'article',
  },
}

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Contact Form Not Working? Why Forms Fail Silently and How to Test Yours',
  description:
    'The five ways contact forms fail without showing an error, why they pass the owner’s test and fail for real visitors, and how to test yours properly in five minutes.',
  datePublished: '2026-07-07',
  author: {
    '@type': 'Organization',
    name: 'QAlaunch',
    url: 'https://getqalaunch.com',
  },
  url: 'https://getqalaunch.com/blog/contact-form-not-working',
}

const FAQS = [
  {
    q: 'How do I test if my contact form is actually working?',
    a: 'Open your live site in an incognito window, submit the form with a real message from an email address you control, then verify the message arrived at its destination — your inbox, your CRM, or your database. Not the success message on screen: the actual destination. If it isn’t there within a few minutes (check spam too), your form is broken.',
  },
  {
    q: 'Why does my form show "message sent" but I never receive anything?',
    a: 'Because the success message and the delivery are two separate steps, and most forms show the first regardless of the second. The frontend confirms it fired the request; whether an email was generated, accepted, and delivered is decided later, by systems the success message never hears back from. That gap is exactly where forms fail silently.',
  },
  {
    q: 'Why are my contact form emails going to spam?',
    a: 'Usually because the email is sent from your web server without authentication — no SPF, DKIM, or DMARC records proving the message legitimately comes from your domain. Receiving servers treat unauthenticated mail with suspicion. Fixes: send through an authenticated SMTP or transactional email service instead of the server’s default mail function, and verify your domain’s DNS records.',
  },
  {
    q: 'How often should I test my website’s forms?',
    a: 'After every change to your site — theme updates, plugin updates, new sections, replatforming — and on a monthly schedule even when nothing changed, because the failure can be on the email side rather than your site. The test takes five minutes. Weeks of silently lost enquiries cost considerably more.',
  },
  {
    q: 'My Lovable / Bolt site’s form worked in the preview but not on the live site. Why?',
    a: 'The builder preview runs with your session, your permissions, and the builder’s environment. The live site runs with a visitor’s permissions and production configuration. If an environment variable didn’t make it to production, or your database only permits writes from the account you built with, the form works for exactly one person: you.',
  },
  {
    q: 'Can a tool test my contact form automatically?',
    a: 'Partly. QAlaunch opens your live site in a real browser as an anonymous visitor and checks that forms render, accept input, validate sensibly, and respond on submission — which catches broken buttons, dead endpoints, and mobile-unusable fields. End-to-end delivery into your specific inbox still needs the one-time manual test described above, because only you can see your inbox.',
  },
]

export default function ContactFormNotWorkingPost() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SiteNav />
      <main className="bg-white min-h-screen pt-16">

      <article className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-xs font-bold tracking-widest uppercase text-[#16a34a] mb-4">
          FORMS · QA
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight mb-5 text-[#09111f]">
          Contact Form Not Working? Why Forms Fail Silently — and How to Test Yours
        </h1>

        {/* Answer-first summary — this is the part AI engines extract and cite */}
        <p className="text-[#09111f] text-lg leading-relaxed mb-8 font-medium border-l-4 border-[#22c55e] pl-4">
          Most broken contact forms fail silently: the visitor sees &quot;message sent,&quot; but
          nothing arrives. The usual causes are unauthenticated email landing in spam, a
          misconfigured recipient, a plugin or theme update, or — on AI-built sites — backend
          wiring that only worked in the builder. The only reliable test: submit the form as a
          stranger and verify it arrives.
        </p>

        <p className="text-[#5b6472] text-lg leading-relaxed mb-4">
          A broken contact form is the worst bug a business website can have, and it&apos;s not
          close. A broken layout looks bad; a broken form costs you every single person who tried to
          reach you and assumed you didn&apos;t answer. And unlike almost any other failure, it
          generates no complaint — the visitor believes their message went through, and you
          believe nobody wrote. Both sides think everything is fine.
        </p>
        <p className="text-[#5b6472] text-lg leading-relaxed mb-10">
          I&apos;ve spent nine years testing software, and forms are where I&apos;ve seen the most
          real-world damage per bug. Here&apos;s how they fail, why yours passed when you tested it,
          and the five-minute protocol that actually proves a form works.
        </p>

        <h2 className="text-2xl font-bold text-[#09111f] mb-4">
          How would I even know my contact form is broken?
        </h2>
        <p className="text-[#3b4253] leading-relaxed mb-4">
          That&apos;s the trap: you usually wouldn&apos;t. A broken form doesn&apos;t throw an error
          you&apos;ll see, doesn&apos;t appear in analytics as anything but a normal page visit, and
          doesn&apos;t stop the site from looking perfect. The only externally visible symptom is an
          absence — fewer enquiries than usual — which is indistinguishable from a slow month.
        </p>
        <p className="text-[#3b4253] leading-relaxed mb-10">
          In audits, the tell is duration: when we find a dead form, it has typically been dead for
          weeks, sometimes months — usually since a specific update or change nobody connected to
          it. If your enquiries dipped and you &quot;can&apos;t remember the last time the form was
          tested,&quot; treat the form as guilty until proven innocent.
        </p>

        <h2 className="text-2xl font-bold text-[#09111f] mb-6">
          The five ways contact forms fail
        </h2>

        <h3 className="text-xl font-bold text-[#09111f] mb-2">
          1. The email is never sent at all
        </h3>
        <p className="text-[#3b4253] leading-relaxed mb-6">
          The form submits, the backend tries to hand the message to an email system, and that
          handoff fails: the site&apos;s mail function is disabled by the host, an API key for the
          email service expired, or the sending step errors in a log nobody reads. The visitor still
          sees a success message, because the frontend&apos;s job ended when the request fired.
          Nothing was ever addressed to you, so there&apos;s nothing to find in spam either.
        </p>

        <h3 className="text-xl font-bold text-[#09111f] mb-2">
          2. The email sends — straight into spam
        </h3>
        <p className="text-[#3b4253] leading-relaxed mb-6">
          Web servers sending mail directly, without SPF/DKIM/DMARC authentication on the domain,
          look exactly like spammers to receiving servers — so their messages get filtered or
          rejected outright. This one is sneaky because it can work for months and then stop when a
          mail provider tightens its rules, with zero changes on your site. If your form
          notifications come &quot;from&quot; your own domain but aren&apos;t authenticated, assume
          some of them are already being eaten.
        </p>

        <h3 className="text-xl font-bold text-[#09111f] mb-2">
          3. The success message is lying
        </h3>
        <p className="text-[#3b4253] leading-relaxed mb-6">
          Common on AI-built sites, and #1 in our list of{' '}
          <Link href="/blog/vibe-coding-website-bugs" className="text-[#16a34a] font-semibold hover:underline">
            bugs almost every vibe-coded site ships with
          </Link>
          : the AI generates a beautiful form, a convincing &quot;Thanks, we&apos;ll be in
          touch!&quot; state — and no working connection between them. The success state renders
          whether or not anything was saved or sent, because it was built as UI, not as
          confirmation. The database write fails on visitor permissions, or the endpoint
          doesn&apos;t exist in production, and the form congratulates the visitor anyway.
        </p>

        <h3 className="text-xl font-bold text-[#09111f] mb-2">
          4. The form can&apos;t actually be completed on a phone
        </h3>
        <p className="text-[#3b4253] leading-relaxed mb-6">
          A required checkbox rendered half off-screen at 375px. A date picker that doesn&apos;t open
          in iOS Safari. A dropdown whose options overflow the viewport. A submit button pushed below
          an on-screen keyboard with no way to scroll to it. The form is technically functional and
          practically unusable — for the majority of your visitors, who are on phones. (If your
          site has other problems at phone width, they travel together — see{' '}
          <Link href="/blog/website-looks-fine-on-desktop-broken-on-mobile" className="text-[#16a34a] font-semibold hover:underline">
            why sites look fine on desktop but break on mobile
          </Link>
          .)
        </p>

        <h3 className="text-xl font-bold text-[#09111f] mb-2">
          5. It worked — until an update broke it
        </h3>
        <p className="text-[#3b4253] leading-relaxed mb-10">
          Forms sit at the intersection of the most moving parts: theme, form plugin, mail plugin,
          host configuration, third-party service. Any of them updating can break the chain. This is
          the classic WordPress failure — a plugin update changes how mail is sent, and enquiries
          stop with no visible change anywhere on the site. It&apos;s why &quot;we redesigned /
          updated / migrated recently&quot; and &quot;enquiries feel slow lately&quot; so often
          appear in the same sentence.
        </p>

        {/* Generated illustration — the "success message is lying" failure mode. */}
        <Image
          src="/blog/form-success-message-lying.png"
          alt="Illustration of a contact form displaying a message sent success confirmation while the destination inbox shows no new messages and the database shows zero rows"
          width={1200}
          height={675}
          className="mb-10 border border-[#e3e5ea]"
        />

        <h2 className="text-2xl font-bold text-[#09111f] mb-4">
          Why did the form work when I tested it?
        </h2>
        <p className="text-[#3b4253] leading-relaxed mb-4">
          Because you didn&apos;t test the form — you tested the form <em>as you</em>. On your own
          machine, often logged into your own site or builder, in an environment configured around
          your account. That version of the form has permissions, sessions, and configuration a real
          visitor doesn&apos;t have.
        </p>
        <p className="text-[#3b4253] leading-relaxed mb-4">
          The starkest version is AI builders. In Lovable or Bolt, the preview runs inside your
          authenticated workspace: database writes succeed because <em>you</em> are allowed to
          write. Publish the site, and a visitor&apos;s submission hits the same database as an
          anonymous stranger — and if permissions only allow the owner, it fails. Same form, same
          code, different person. This is also why the fix for a vibe-coded form is usually one
          prompt away (&quot;allow anonymous visitors to submit the contact form&quot;) — once you
          know it&apos;s broken.
        </p>
        <p className="text-[#3b4253] leading-relaxed mb-10">
          The rule that follows: a form test only counts if it&apos;s done as a stranger, on the
          live site, verified at the destination.
        </p>

        <h2 className="text-2xl font-bold text-[#09111f] mb-4">
          How to test a contact form properly — the 5-minute protocol
        </h2>
        <ol className="list-decimal pl-6 text-[#3b4253] leading-relaxed mb-4 space-y-3">
          <li>
            <strong>Open your live site in an incognito window.</strong> Not the builder, not the
            preview, not while logged in. Incognito strips your sessions and cookies — you&apos;re
            now approximately a stranger.
          </li>
          <li>
            <strong>Submit a real test message</strong> with an identifiable subject like
            &quot;FORM TEST July 7&quot; from an email address you control.
          </li>
          <li>
            <strong>Verify at the destination, not the screen.</strong> The success message counts
            for nothing. Check the inbox the form should deliver to — and the spam folder. If
            submissions go to a database or CRM, look there. Give it five minutes.
          </li>
          <li>
            <strong>Test the failure path too.</strong> Submit with an invalid email and a missing
            required field. You should get a clear, visible error — a form that accepts garbage
            silently has the same disease as one that drops messages.
          </li>
          <li>
            <strong>Repeat at phone width.</strong> Fill and submit the same form at 375px (Chrome
            DevTools device mode, or your actual phone). Every field reachable, keyboard behaving,
            submit button tappable.
          </li>
        </ol>
        <p className="text-[#3b4253] leading-relaxed mb-10">
          Then put a monthly reminder in your calendar and re-run steps 1–3. Not because your site
          will change — because the email side can break without your site changing at all.
        </p>

        {/* Checklist graphic of the 5-step protocol — also usable as the social/OG image. */}
        <Image
          src="/blog/contact-form-test-protocol-checklist.png"
          alt="Five-step checklist for testing a website contact form: open incognito, submit a test message, verify at the destination inbox, test validation errors, repeat at mobile width"
          width={1200}
          height={900}
          className="mb-10 border border-[#e3e5ea]"
        />

        <h2 className="text-2xl font-bold text-[#09111f] mb-4">
          Platform notes: WordPress, Shopify, and AI builders
        </h2>
        <p className="text-[#3b4253] leading-relaxed mb-4">
          <strong>WordPress:</strong> most form failures are mail-delivery failures. If the form
          plugin says &quot;sent&quot; and nothing arrives, the fix is almost always routing mail
          through an authenticated SMTP service instead of the server default, via a plugin like WP
          Mail SMTP. Form and mail plugins should be on your shortlist of things to re-test after{' '}
          <em>every</em> update — more in our{' '}
          <Link href="/for-wordpress" className="text-[#16a34a] font-semibold hover:underline">
            WordPress site check guide
          </Link>
          .
        </p>
        <p className="text-[#3b4253] leading-relaxed mb-4">
          <strong>Shopify:</strong> the built-in contact form is reliable at sending — to the
          store&apos;s configured sender email, which after years of admin changes isn&apos;t always
          an inbox anyone reads. Verify where it actually delivers. Custom-theme forms and
          app-injected forms need the full protocol above; our{' '}
          <Link href="/for-shopify" className="text-[#16a34a] font-semibold hover:underline">
            Shopify store audit guide
          </Link>{' '}
          covers the other conversion killers that tend to accompany them.
        </p>
        <p className="text-[#3b4253] leading-relaxed mb-10">
          <strong>Lovable / Bolt / Replit / v0:</strong> assume the form is broken until the
          incognito test passes. The builder preview cannot tell you — it runs as you. Check that
          environment variables exist in production and that anonymous visitors are permitted to
          write the submission. One test as a stranger settles it.
        </p>

        <h2 className="text-2xl font-bold text-[#09111f] mb-6">Frequently asked questions</h2>
        <div className="divide-y divide-[#e3e5ea] mb-14">
          {FAQS.map((faq) => (
            <div key={faq.q} className="py-5">
              <h3 className="font-semibold mb-2 text-[#09111f]">{faq.q}</h3>
              <p className="text-sm text-[#5b6472] leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#eef6f0] border border-[#d1e9d9] p-6">
          <h2 className="text-lg font-bold mb-2 text-[#09111f]">
            Find out if your form is quietly costing you enquiries
          </h2>
          <p className="text-sm text-[#3b4253] mb-4 leading-relaxed">
            <Link href="/" className="text-[#16a34a] font-semibold hover:underline">QAlaunch</Link>{' '}
            opens your live site in a real cloud browser as an anonymous visitor — the stranger
            test, automated — and checks your forms, buttons, links, and mobile rendering along
            with 30+ other things owners can&apos;t see from the inside. Free scan, about two
            minutes, no signup.
          </p>
          <p className="text-sm text-[#3b4253]">
            More from the audit trenches:{' '}
            <Link href="/blog/vibe-coding-website-bugs" className="text-[#16a34a] font-semibold hover:underline">
              the nine bugs AI-built sites ship with
            </Link>{' '}
            and{' '}
            <Link href="/blog/website-looks-fine-on-desktop-broken-on-mobile" className="text-[#16a34a] font-semibold hover:underline">
              why your site looks fine on desktop but breaks on mobile
            </Link>
            .
          </p>
        </div>
      </article>

      </main>
      <SiteFooter />
    </>
  )
}
