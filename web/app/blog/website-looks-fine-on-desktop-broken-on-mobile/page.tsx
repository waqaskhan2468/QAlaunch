import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { SiteNav } from '@/components/site/site-nav'
import { SiteFooter } from '@/components/site/site-footer'

export const metadata: Metadata = {
  title: 'Why Your Website Looks Fine on Desktop but Broken on Mobile',
  description:
    'Your site looks perfect on your monitor and broken on your visitors’ phones. A QA engineer explains the six most common causes, why you never noticed, and how to find every mobile bug on your site in minutes.',
  openGraph: {
    title: 'Why Your Website Looks Fine on Desktop but Broken on Mobile',
    description:
      'The six most common reasons websites break at phone widths, why owners never notice, and how to check your own site the way a QA engineer would.',
    url: 'https://getqalaunch.com/blog/website-looks-fine-on-desktop-broken-on-mobile',
    type: 'article',
  },
}

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Why Your Website Looks Fine on Desktop but Broken on Mobile',
  description:
    'The six most common reasons websites break at phone widths, why owners never notice, and how to check your own site the way a QA engineer would.',
  datePublished: '2026-07-07',
  author: {
    '@type': 'Organization',
    name: 'QAlaunch',
    url: 'https://getqalaunch.com',
  },
  url: 'https://getqalaunch.com/blog/website-looks-fine-on-desktop-broken-on-mobile',
}

const FAQS = [
  {
    q: 'How do I see the mobile version of my website on my computer?',
    a: 'Open your site in Chrome, press F12 (or right-click → Inspect), then click the small phone/tablet icon in the top-left of the DevTools panel — or press Ctrl+Shift+M (Cmd+Shift+M on Mac). Set the width to 375px. That’s a realistic small phone. Now use your site: scroll every page, tap every button, open every menu.',
  },
  {
    q: 'What screen width should I test my website at?',
    a: 'If you only test one width, make it 375px — the iPhone SE and the narrowest common viewport. If a layout survives 375px it almost always survives everything wider. If you have five more minutes, also check 390px (recent iPhones) and 360px (many Android phones).',
  },
  {
    q: 'Is browser device emulation the same as testing on a real phone?',
    a: 'It’s about 80% of the way there, and it catches nearly all layout bugs — overflow, unreadable text, broken grids. What it doesn’t catch: real touch behaviour, iOS Safari quirks (date inputs, viewport height, some CSS features), and how the page feels on a real connection. Use emulation for layout, then confirm the critical flows on an actual phone.',
  },
  {
    q: 'Why does my website look different in Safari on iPhone than in Chrome?',
    a: 'Every browser on iOS uses Apple’s WebKit engine, which handles some JavaScript events, form controls, and CSS features differently from Chrome’s engine. If your site was built and previewed only in Chrome — which is what every AI builder’s preview pane uses — Safari is where the surprises live. Test it: that’s effectively every iPhone visitor you have.',
  },
  {
    q: 'How much of my traffic is actually on mobile?',
    a: 'Check your own analytics rather than trusting industry averages, but for most marketing sites, blogs, and stores it’s the majority of visits — and for traffic from social media links it’s nearly all of it. Practically: the version of your site you look at least is the version most of your visitors get.',
  },
  {
    q: 'Can a tool check mobile responsiveness for me automatically?',
    a: 'Yes — that’s exactly what QAlaunch does. It opens your live site in a real cloud browser at both desktop and phone widths, takes screenshots of what actually renders, and runs automated checks plus an AI visual review to flag overflow, unreadable text, broken layouts, and buttons that don’t work. The free scan takes about two minutes and doesn’t need a signup.',
  },
]

export default function DesktopFineMobileBrokenPost() {
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
          MOBILE · QA
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight mb-5 text-[#09111f]">
          Why Your Website Looks Fine on Desktop but Broken on Mobile
        </h1>

        {/* Answer-first summary — this is the part AI engines extract and cite */}
        <p className="text-[#09111f] text-lg leading-relaxed mb-8 font-medium border-l-4 border-[#22c55e] pl-4">
          Websites look fine on desktop but break on mobile because they were built and checked at
          desktop width. At 375px, fixed-width elements overflow, text becomes unreadable, and
          hover-based menus stop working — and the owner never sees it, because owners test on
          their own machines. The fix: audit your live site at real phone widths, page by page.
        </p>

        <p className="text-[#5b6472] text-lg leading-relaxed mb-4">
          This is the single most common complaint behind the audits we run: &quot;my site looks
          perfect on my laptop, but someone just told me it&apos;s a mess on their phone.&quot; It&apos;s
          not bad luck and it&apos;s not a mystery. It&apos;s a predictable result of how websites get
          built — and after nine years of QA work, I can tell you it almost always comes down to
          the same handful of causes.
        </p>
        <p className="text-[#5b6472] text-lg leading-relaxed mb-10">
          Below: why it happens, the six specific bugs behind nearly every &quot;broken on
          mobile&quot; report, and how to check your own site properly in about fifteen minutes.
        </p>

        <h2 className="text-2xl font-bold text-[#09111f] mb-4">
          Why does a website break on mobile in the first place?
        </h2>
        <p className="text-[#3b4253] leading-relaxed mb-4">
          A phone doesn&apos;t get a special copy of your website. It gets the same HTML and CSS your
          desktop gets, squeezed into a viewport roughly one quarter as wide — 375 to 430 pixels
          instead of 1,400+. Whether that goes well depends entirely on whether your layout was
          written to <em>bend</em>: columns that stack, images that shrink, text that wraps, menus
          that collapse.
        </p>
        <p className="text-[#3b4253] leading-relaxed mb-4">
          Layouts bend when they use responsive rules — breakpoints that say &quot;below this
          width, do this instead.&quot; They snap when something in them has a fixed size: a table
          that&apos;s 900px wide no matter what, a hero image with a hard-coded width, a section
          padding that made sense on a monitor and eats half the screen on a phone.
        </p>
        <p className="text-[#3b4253] leading-relaxed mb-10">
          Here&apos;s the part that matters: <strong>one</strong> rigid element is enough. A single
          component wider than the viewport — even by a few pixels — gives the whole page a
          horizontal scrollbar and makes everything feel broken, even if the other 95% of the page is
          perfectly responsive. That&apos;s why sites don&apos;t degrade gracefully on mobile; they
          tend to look either fine or wrecked.
        </p>

        {/* Generated illustration — can be swapped for a real anonymized audit example later. */}
        <Image
          src="/blog/desktop-vs-mobile-comparison.png"
          alt="Side-by-side illustration of the same web page rendered at 1440px desktop width looking correct and at 375px mobile width with overflowing text and a button cut off by the screen edge"
          width={1200}
          height={675}
          className="mb-10 border border-[#e3e5ea]"
        />

        <h2 className="text-2xl font-bold text-[#09111f] mb-6">
          The six mobile bugs behind almost every &quot;it&apos;s broken on my phone&quot;
        </h2>

        <h3 className="text-xl font-bold text-[#09111f] mb-2">
          1. Horizontal overflow — the one-pixel problem
        </h3>
        <p className="text-[#3b4253] leading-relaxed mb-6">
          The page scrolls sideways as well as down. Usually caused by a full-width image, an
          embedded table, a code block, or a section with fixed padding that adds up to more than
          375px. The symptom visitors describe is vague — &quot;the site feels off&quot; —
          because content keeps drifting out of view as they scroll. Check: at 375px, try to swipe
          the page left. If anything moves horizontally, something is overflowing.
        </p>

        <h3 className="text-xl font-bold text-[#09111f] mb-2">
          2. Fixed widths that refuse to bend
        </h3>
        <p className="text-[#3b4253] leading-relaxed mb-6">
          A pricing table locked at four columns. A form field set to 600px. A grid of cards that
          never stacks. On a monitor these read as tidy structure; at phone width they compress into
          overlapping, truncated fragments. This is the most common bug in sites assembled from
          mixed sources — a theme here, a copied section there, an AI-generated block on top —
          because each piece made its own assumptions about available width.
        </p>

        <h3 className="text-xl font-bold text-[#09111f] mb-2">
          3. Text and buttons that become unreadable at 375px
        </h3>
        <p className="text-[#3b4253] leading-relaxed mb-6">
          Contrast and size that pass on a 27-inch monitor can fail completely on a phone in
          daylight: 13px grey text on a light background, a CTA whose label inherits a different
          colour at mobile breakpoints and quietly vanishes into the button behind it. We flag some
          version of this in a large share of the sites we audit, and it&apos;s the most expensive
          bug on this list — an invisible call-to-action doesn&apos;t get tapped. This is the
          same class of bug as #2 in our rundown of{' '}
          <Link href="/blog/vibe-coding-website-bugs" className="text-[#16a34a] font-semibold hover:underline">
            the nine bugs almost every AI-built site ships with
          </Link>
          .
        </p>

        {/* Generated illustration — can be swapped for a real audit screenshot later. */}
        <Image
          src="/blog/invisible-cta-mobile-375.png"
          alt="Mockup of a website hero section at 375px mobile width where the call-to-action button text is nearly invisible against the button background colour"
          width={750}
          height={500}
          className="mb-8 border border-[#e3e5ea]"
        />

        <h3 className="text-xl font-bold text-[#09111f] mb-2">
          4. The hero that swallows the whole screen
        </h3>
        <p className="text-[#3b4253] leading-relaxed mb-6">
          A hero section sized for a widescreen preview often renders at 150% of a phone&apos;s
          viewport height. A mobile visitor lands, sees a heading and a background — no value
          proposition, no button — and has to scroll on faith to find out what the site even
          does. Many don&apos;t. Check: load your homepage at 375px and ask one question — can I
          see what this site offers <em>and</em> a way to act on it, without scrolling?
        </p>

        <h3 className="text-xl font-bold text-[#09111f] mb-2">
          5. Tap targets built for a mouse cursor
        </h3>
        <p className="text-[#3b4253] leading-relaxed mb-6">
          A mouse pointer is a single pixel; a fingertip is roughly a 44px circle. Links stacked
          tightly in a footer, tiny carousel arrows, close buttons in the corner of a popup — all
          precise and comfortable with a mouse, all frustrating lotteries with a thumb. The visitor
          taps the wrong thing twice, then leaves. If interactive elements on your site are smaller
          than about 44×44px or packed closer than 8px apart, mobile users are mis-tapping.
        </p>

        <h3 className="text-xl font-bold text-[#09111f] mb-2">
          6. Hover interactions that don&apos;t exist on a touchscreen
        </h3>
        <p className="text-[#3b4253] leading-relaxed mb-10">
          Dropdown menus that open on hover, tooltips that explain a feature, image zooms, reveal-on-
          hover buttons on cards: there is no hover on a touchscreen. At best the first tap
          substitutes for it; at worst the content is simply unreachable. If any information or
          navigation on your site is <em>only</em> available on hover, a mobile visitor cannot get to
          it at all.
        </p>

        <h2 className="text-2xl font-bold text-[#09111f] mb-4">
          Why didn&apos;t I notice my own site was broken?
        </h2>
        <p className="text-[#3b4253] leading-relaxed mb-4">
          Because you test your site under the exact conditions that hide these bugs. You open it on
          the machine you built it on, at the window size you designed for, already knowing where
          everything is and what every button does. You are the best-case visitor. Your customers are
          the worst case: a phone, one thumb, no context, and about three seconds of patience.
        </p>
        <p className="text-[#3b4253] leading-relaxed mb-10">
          This isn&apos;t carelessness — it&apos;s structural. Nobody habitually browses their own
          site on a phone the way strangers do, and mobile bugs produce no error message, no crash
          log, no alert. The page renders. It renders <em>wrong</em>, silently, only on devices you
          aren&apos;t looking at. The only counter to it is deliberately testing as the stranger.
        </p>

        <h2 className="text-2xl font-bold text-[#09111f] mb-4">
          Does this happen more with AI website builders like Lovable and Bolt?
        </h2>
        <p className="text-[#3b4253] leading-relaxed mb-4">
          Yes, measurably — and there&apos;s a specific reason. When you build with{' '}
          <Link href="/for-lovable" className="text-[#16a34a] font-semibold hover:underline">
            Lovable
          </Link>{' '}
          or{' '}
          <Link href="/for-bolt" className="text-[#16a34a] font-semibold hover:underline">
            Bolt.new
          </Link>
          , you watch your site take shape in a preview pane that renders at desktop width. Every
          prompt, every iteration, every &quot;that looks great, ship it&quot; moment happens at a
          width your mobile visitors will never see. The AI does often generate responsive classes
          — but nobody verifies them, because the one screen the builder shows you is the one
          screen where everything already works.
        </p>
        <p className="text-[#3b4253] leading-relaxed mb-10">
          The result is a site that is genuinely finished on desktop and completely unreviewed on
          mobile. Not broken by the AI — broken by the workflow. Which is also why the fix
          isn&apos;t &quot;prompt better&quot;; it&apos;s reviewing the deployed site at phone width,
          the one place the builder never showed you.
        </p>

        <h2 className="text-2xl font-bold text-[#09111f] mb-4">
          How to check your site on mobile — the 15-minute version
        </h2>
        <p className="text-[#3b4253] leading-relaxed mb-4">
          You don&apos;t need a device lab. You need your live site — not the builder preview, not
          localhost — and this sequence:
        </p>
        <ol className="list-decimal pl-6 text-[#3b4253] leading-relaxed mb-4 space-y-3">
          <li>
            <strong>Open DevTools device mode.</strong> In Chrome: F12, then Ctrl+Shift+M
            (Cmd+Shift+M on Mac). Set width to 375px — the narrowest mainstream phone. Don&apos;t
            pick a generous width; if it survives 375, it survives everything.
          </li>
          <li>
            <strong>Walk every page, top to bottom.</strong> You&apos;re looking for: horizontal
            scroll, overlapping or cut-off text, images spilling out of containers, sections with
            absurd empty space, anything requiring a squint.
          </li>
          <li>
            <strong>Tap everything.</strong> Every nav item, every dropdown, every button, every
            footer link. Menus that open on hover and buttons that go nowhere reveal themselves
            here.
          </li>
          <li>
            <strong>Submit your forms.</strong> Actually fill and send them at mobile width —
            validation and keyboard behaviour differ on phones, and a form you can&apos;t complete
            with a thumb is a dead form.
          </li>
          <li>
            <strong>Repeat the critical path on a real iPhone.</strong> Emulation catches layout;
            Safari catches the rest. Homepage → key page → form or checkout, once, on an
            actual device.
          </li>
        </ol>
        <p className="text-[#3b4253] leading-relaxed mb-10">
          Fifteen minutes, honestly spent, finds most of it. The failure mode isn&apos;t that this is
          hard — it&apos;s that nobody does it after <em>every</em> change, and mobile layouts
          break quietly with every edit, theme update, and new section.
        </p>

        {/* Generated illustration of the DevTools device-mode workflow from step 1. */}
        <Image
          src="/blog/chrome-devtools-device-mode-375.png"
          alt="Illustration of Chrome DevTools device emulation mode testing a website at 375px mobile width with the device toolbar and width field visible"
          width={1200}
          height={750}
          className="mb-10 border border-[#e3e5ea]"
        />

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
            Or let a real browser check it for you
          </h2>
          <p className="text-sm text-[#3b4253] mb-4 leading-relaxed">
            The 15-minute check above is exactly what{' '}
            <Link href="/" className="text-[#16a34a] font-semibold hover:underline">QAlaunch</Link>{' '}
            automates — plus about 30 more checks. It opens your live site in a real cloud
            browser at desktop and phone widths, screenshots what actually renders, and flags
            overflow, invisible buttons, unreadable text, and broken layouts in plain English. The
            free scan takes about two minutes, no signup.
          </p>
          <p className="text-sm text-[#3b4253]">
            Built with an AI tool? See the platform guides:{' '}
            <Link href="/for-lovable" className="text-[#16a34a] font-semibold hover:underline">testing Lovable sites</Link>{' '}
            and{' '}
            <Link href="/for-bolt" className="text-[#16a34a] font-semibold hover:underline">testing Bolt.new sites</Link>
            , or the full list of{' '}
            <Link href="/blog/vibe-coding-website-bugs" className="text-[#16a34a] font-semibold hover:underline">
              nine bugs AI-built sites ship with
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
