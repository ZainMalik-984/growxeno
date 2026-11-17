/**
 * Grow Xeno home page content (source: growxeno.com). Kept apart from the
 * layout so the copy, services and their metrics stay exactly the same
 * whatever the page looks like. The page itself is src/app/marketing-home.tsx.
 */

export type ServiceId = "youtube" | "tiktok" | "adsense" | "smm" | "web" | "shopify";

export type Service = {
  id: ServiceId;
  name: string;
  short: string;
  audience: string;
  summary: string;
  includes: string[];
  target: [string, string][];
  outcome: string;
};

export const services: Service[] = [
  {
    id: "youtube",
    name: "YouTube Monetization",
    short: "Channels built to Partner Program eligibility",
    audience: "Creators and buyers who want a monetization-ready channel",
    summary:
      "We build channels up to YouTube's monetization threshold, and handle buying and selling of channels that are already monetized.",
    includes: ["Channel growth to the eligibility threshold", "Buying already-monetized channels", "Selling your monetized channel", "Handover walkthrough & securing the account"],
    target: [["Subscribers", "1,000"], ["Watch hours", "4,000"]],
    outcome: "A channel that meets YouTube's monetization requirements, verified before it's handed over.",
  },
  {
    id: "tiktok",
    name: "TikTok Growth",
    short: "Accounts grown to monetization eligibility",
    audience: "Creators and brands who need an eligible TikTok presence",
    summary:
      "Accounts grown to 10,000 followers with 1M+ views in the trailing 28 days, so they're monetization-eligible. We also buy and sell established accounts.",
    includes: ["Follower growth to eligibility", "Qualified view volume in the trailing 28 days", "Buying & selling accounts", "Direct handover with walkthrough"],
    target: [["Followers", "10,000"], ["Views / 28 days", "1M+"]],
    outcome: "A monetization-eligible TikTok account, checked against the numbers that were agreed.",
  },
  {
    id: "adsense",
    name: "Google AdSense",
    short: "Approval support and pin-verified accounts",
    audience: "Website owners and publishers ready to earn from ads",
    summary:
      "AdSense approval support for sites across Pakistan, the UK, the US, India and beyond, plus fresh, pin-verified AdSense accounts.",
    includes: ["Approval support for your website", "Fresh, pin-verified accounts", "Guidance across multiple regions", "Post-delivery support"],
    target: [["Regions", "PK · UK · US · IN +"], ["Accounts", "Pin-verified"]],
    outcome: "An approved, working AdSense setup so your site can start earning.",
  },
  {
    id: "smm",
    name: "Social Media Management",
    short: "Content, posting and growth across every platform",
    audience: "Brands and businesses that want an active, growing social presence",
    summary:
      "We run your social accounts end to end: content planning, post design, posting on schedule, replying to your audience and paid campaigns, with a monthly report on what grew.",
    includes: [
      "Content calendar & post design",
      "Scheduling & posting across platforms",
      "Community management (comments & DMs)",
      "Paid ad campaigns (Meta, LinkedIn)",
      "Profile setup & optimisation",
      "Monthly performance report",
    ],
    target: [["Platforms", "All major"], ["Reporting", "Monthly"]],
    outcome: "Consistent, on-brand accounts that grow followers and bring in enquiries.",
  },
  {
    id: "web",
    name: "Website & App Design",
    short: "Websites, web apps and SaaS products",
    audience: "Businesses that need a site or product that represents them properly",
    summary:
      "User-friendly websites and web apps, SaaS products included, built so your digital presence actually represents your business.",
    includes: ["Business websites", "Web applications", "SaaS products", "Usability-focused design"],
    target: [["Scope", "Sites · Apps · SaaS"], ["Focus", "Usability"]],
    outcome: "A site or app your customers find easy to use, and you're proud to send people to.",
  },
  {
    id: "shopify",
    name: "Shopify Growth",
    short: "SEO, Google Ads and technical fixes",
    audience: "Owners of existing Shopify stores who want more sales",
    summary:
      "SEO and Google Ads to grow an existing store, plus hands-on help resolving the technical issues that quietly cost you sales.",
    includes: ["Store SEO", "Google Ads campaigns", "Technical issue resolution", "Ongoing growth support"],
    target: [["Channels", "SEO · Google Ads"], ["Store", "Existing Shopify"]],
    outcome: "More qualified traffic and fewer technical leaks in your store.",
  },
];

export const steps = [
  { t: "Tell us what you need", d: "Send a quick message about your goal: a channel, an account, a store or a site.", when: "Day one" },
  { t: "Get a straight quote", d: "A clear price for exactly what you asked for. No bundled upsells.", when: "Before any payment" },
  { t: "We deliver & verify", d: "The work is checked against what was promised before it's called done.", when: "Before handover" },
  { t: "Ongoing support", d: "Questions after delivery get answered. It isn't a one-and-done handoff.", when: "After delivery" },
];

export const faqs: [string, string][] = [
  ["How is a channel or account “delivered”?", "Account credentials and any required transfer steps are handed over directly, with a walkthrough so you know exactly what you're receiving and how to secure it."],
  ["What if the numbers don't match what was promised?", "Delivery is verified against what was agreed before handover. If anything doesn't match, raise it with us directly and we'll work through it with you as part of after-delivery support."],
  ["Do you only work with clients in Pakistan?", "No. Grow Xeno is remote-first and works with clients worldwide."],
  ["Can I get ongoing marketing help, not just a one-time account?", "Yes. Alongside one-time deliveries we offer hands-on marketing coaching and ongoing growth work for stores and brands."],
  ["Will I be pushed into a bigger package?", "No. You get a quote for exactly what you asked for. We don't bundle in extras you didn't request."],
];

export const audiences = [
  { id: "creators", t: "Creators", d: "Reach YouTube or TikTok monetization, or buy a channel that's already there.", tag: "YouTube · TikTok" },
  { id: "publishers", t: "Publishers", d: "Get your website approved for AdSense and start earning from your traffic.", tag: "Google AdSense" },
  { id: "stores", t: "Store owners", d: "Grow an existing Shopify store with SEO, ads and technical fixes.", tag: "Shopify Growth" },
  { id: "business", t: "Businesses & marketers", d: "Launch a website or app, or build a social media marketing operation.", tag: "Web · SMM" },
] as const;

/** The market vs. Grow Xeno, in the order the brief names them. */
export const comparison: { area: string; market: string; us: string }[] = [
  { area: "Transparent delivery", market: "Vague promises", us: "Delivery checked against what was promised" },
  { area: "Direct communication", market: "Ticket queues and auto-replies", us: "You talk to the person doing the work" },
  { area: "Straight pricing", market: "Bundled extras you didn't ask for", us: "A straight quote for exactly what you need" },
  { area: "Support after delivery", market: "Relationship ends at payment", us: "Support continues if something needs adjusting" },
  { area: "Verification before handover", market: "Anonymous handoff, then silence", us: "Every account or asset checked before it's handed to you" },
];

export const whyPoints: [string, string][] = [
  ["Transparent, verified delivery", "No anonymous handoffs. Checked before it's yours, not after you've paid and gone quiet."],
  ["Real people, direct communication", "Questions get answered, not auto-replied."],
  ["Support after delivery", "If something needs adjusting afterwards, we're still here."],
];

/** Pre-handover checks: what is checked, and how. */
export const handoverChecks = [
  { code: "QC-01", t: "Delivered against the agreed quote", how: "Exactly what you asked for, no bundled extras" },
  { code: "QC-02", t: "Numbers verified against the promise", how: "Checked against the numbers that were agreed" },
  { code: "QC-03", t: "Walkthrough to secure your account", how: "Credentials and transfer steps handed over directly" },
];

export const NAV: [string, string][] = [["Services", "#services"], ["Why us", "#why"], ["Process", "#process"], ["FAQ", "#faq"]];
