// Closed vocabularies shared by the pipeline (tagging) and the web app (query understanding).
// A closed vocabulary means the LLM picks from an enum, so normalisation is free and
// "Bangalore" vs "Bengaluru" can never fragment the index.

export type Role = { id: string; label: string; hint: string; kw: RegExp };

// Order matters for the rules tagger: first match wins, most specific first.
export const ROLES: Role[] = [
  { id: "security", label: "Cybersecurity", hint: "security analyst, SOC, appsec, pentest, GRC for infosec", kw: /\b(security|soc analyst|appsec|infosec|penetration|pentest|cyber|threat|vulnerabilit)/i },
  { id: "qa", label: "QA & Testing", hint: "manual/automation testing, SDET, quality engineering", kw: /\b(qa|quality (assurance|engineer)|sdet|test(ing|er)?|automation engineer)\b/i },
  { id: "data_ai", label: "Data Science & AI/ML", hint: "ML engineer, data scientist, AI researcher, NLP, computer vision, LLM/GenAI work", kw: /\b(machine learning|ml|ai|artificial intelligence|data scien|deep learning|nlp|computer vision|genai|llm|applied scien|research scien)/i },
  { id: "data_analytics", label: "Data Analytics & Engineering", hint: "data analyst, BI, SQL reporting, data engineer, ETL, analytics engineer", kw: /\b(data (analyst|analytics|engineer)|analytics|business intelligence|bi (analyst|developer)|etl|sql analyst|insights)/i },
  { id: "devops", label: "DevOps, Cloud & IT Infra", hint: "DevOps, SRE, cloud, platform, sysadmin, network engineer, IT helpdesk infrastructure", kw: /\b(devops|sre|site reliability|cloud|platform engineer|infrastructure|sysadmin|system administrator|network engineer|it (support|administrator|engineer)|noc)\b/i },
  { id: "hardware", label: "Hardware, Embedded & Core Engineering", hint: "embedded, firmware, VLSI, electronics, mechanical, civil, electrical, manufacturing engineering", kw: /\b(embedded|firmware|vlsi|asic|fpga|rtl|hardware|electronics|electrical|mechanical|civil|silicon|verification engineer|physical design|manufactur)/i },
  { id: "design", label: "Design", hint: "UI/UX, product design, graphic design, motion, video editing", kw: /\b(design(er)?|ux|ui\/ux|graphic|illustrat|motion|video edit|animator|creative)\b/i },
  { id: "product", label: "Product & Program Management", hint: "product manager/analyst, APM, program or project manager, scrum", kw: /\b(product (manager|management|owner|analyst|associate)|apm|program manag|project manag|project coordinator|scrum|tpm)\b/i },
  { id: "software", label: "Software Engineering", hint: "SDE, backend, frontend, full-stack, mobile, web developer, solutions/implementation engineer who writes code", kw: /\b(software|sde|swe|developer|backend|front[- ]?end|full[- ]?stack|engineer(ing)? intern|programmer|android|ios|mobile|web dev|java|python|react|node|golang|\.net|member of technical staff|mts|engineer)\b/i },
  { id: "marketing", label: "Marketing, Content & Growth", hint: "digital marketing, SEO, social media, content writing, copywriting, brand, growth, PR, community", kw: /\b(marketing|seo|social media|content|copywrit|writer|brand|growth|community|public relations|pr |communications|editor)/i },
  { id: "sales", label: "Sales & Business Development", hint: "sales, BDR/SDR, business development, account executive, partnerships, inside sales", kw: /\b(sales|business development|bdr|sdr|account (executive|manager)|partnership|inside sales|pre[- ]?sales|revenue)\b/i },
  { id: "support", label: "Customer Support & Success", hint: "customer support, customer success, technical support, service desk agent, chat/voice process", kw: /\b(customer (support|success|service|experience|care)|technical support|support (engineer|specialist|associate|executive)|help ?desk|service desk|voice process|chat process)\b/i },
  { id: "finance", label: "Finance & Accounting", hint: "accounting, audit, tax, FP&A, treasury, risk, credit, investment/equity research, payroll processing", kw: /\b(financ|account(ant|ing|s)|audit|tax|treasury|fp&a|risk|credit|underwrit|invest|equity research|payroll|billing|collections|trading|quant)/i },
  { id: "hr", label: "HR & Recruiting", hint: "human resources, talent acquisition, recruiter, people ops, L&D", kw: /\b(hr|human resources|talent|recruit|people (ops|operations|partner)|learning (and|&) development)\b/i },
  { id: "legal", label: "Legal & Compliance", hint: "legal associate, paralegal, contracts, regulatory compliance, KYC/AML, policy", kw: /\b(legal|law|paralegal|contract|compliance|regulatory|kyc|aml|policy)\b/i },
  { id: "operations", label: "Operations & Supply Chain", hint: "business/process operations, logistics, supply chain, procurement, admin, back-office, data entry, trust & safety ops", kw: /\b(operations|ops|supply chain|logistics|procurement|warehouse|fulfil|admin|back[- ]?office|data entry|trust (and|&) safety|moderat|process (associate|executive)|coordinator)\b/i },
  { id: "consulting", label: "Consulting, Strategy & Research", hint: "management consulting, strategy, business analyst (non-data), market research, founder's office, chief of staff", kw: /\b(consult|strategy|business analyst|market research|founder'?s office|chief of staff|research (analyst|associate|intern)|analyst)\b/i },
  { id: "other", label: "Other", hint: "anything that fits none of the above (teaching, healthcare, hospitality, etc.)", kw: /$^/ },
];
export const ROLE_IDS = ROLES.map((r) => r.id);
export const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.id, r.label]));

// Canonical city -> aliases (lowercase). "Remote" and "Pan-India" are pseudo-cities.
export const CITY_ALIASES: Record<string, string[]> = {
  Bengaluru: ["bengaluru", "bangalore", "bengalore", "blr", "bengaluru urban"],
  Hyderabad: ["hyderabad", "secunderabad", "hyd", "cyberabad"],
  Pune: ["pune", "pimpri", "chinchwad", "hinjewadi"],
  Mumbai: ["mumbai", "bombay", "navi mumbai", "thane", "andheri", "powai"],
  Delhi: ["delhi", "new delhi", "delhi ncr", "ncr"],
  Gurugram: ["gurugram", "gurgaon", "ggn"],
  Noida: ["noida", "greater noida"],
  Chennai: ["chennai", "madras"],
  Kolkata: ["kolkata", "calcutta"],
  Ahmedabad: ["ahmedabad", "gandhinagar", "gift city"],
  Jaipur: ["jaipur"],
  Kochi: ["kochi", "cochin", "ernakulam"],
  Indore: ["indore"],
  Chandigarh: ["chandigarh", "mohali", "panchkula", "zirakpur"],
  Coimbatore: ["coimbatore"],
  Thiruvananthapuram: ["thiruvananthapuram", "trivandrum"],
  Lucknow: ["lucknow"],
  Nagpur: ["nagpur"],
  Vadodara: ["vadodara", "baroda"],
  Surat: ["surat"],
  Bhubaneswar: ["bhubaneswar", "bhubaneshwar"],
  Mysuru: ["mysuru", "mysore"],
  Visakhapatnam: ["visakhapatnam", "vizag"],
  Goa: ["goa", "panaji", "panjim"],
  Bhopal: ["bhopal"],
  Patna: ["patna"],
  Guwahati: ["guwahati"],
  Mangaluru: ["mangaluru", "mangalore"],
  Vijayawada: ["vijayawada"],
  Nashik: ["nashik"],
};
export const PSEUDO_CITIES = ["Remote", "Pan-India", "Other"] as const;
export const CITIES = [...Object.keys(CITY_ALIASES), ...PSEUDO_CITIES];

const ALIAS_INDEX: [RegExp, string][] = Object.entries(CITY_ALIASES)
  .flatMap(([city, al]) => al.map((a) => [a, city] as const))
  .sort((a, b) => b[0].length - a[0].length)
  .map(([a, city]) => [new RegExp(`(?<![a-z])${a.replace(/ /g, "\\s+")}(?![a-z])`, "i"), city]);

export const INDIA_RE = new RegExp(
  `(?<![a-z])(india|bharat|${Object.values(CITY_ALIASES).flat().filter((a) => a.length > 3).join("|")}|karnataka|maharashtra|telangana|tamil nadu|haryana|uttar pradesh|gujarat|kerala|west bengal|rajasthan)(?![a-z])`,
  "i",
);

/** Deterministic gazetteer: free-text location -> canonical cities. Second, LLM-independent signal. */
export function gazetteer(location: string): string[] {
  const out = new Set<string>();
  let rest = location;
  for (const [re, city] of ALIAS_INDEX) {
    if (re.test(rest)) {
      out.add(city);
      rest = rest.replace(new RegExp(re.source, "gi"), " ");
    }
  }
  if (/\b(remote|work from home|wfh|anywhere)\b/i.test(location)) out.add("Remote");
  return [...out];
}

export const VERDICTS = ["fresher", "early", "experienced", "unclear"] as const;
export type Verdict = (typeof VERDICTS)[number];
export const VERDICT_LABEL: Record<Verdict, string> = {
  fresher: "True fresher · 0 yrs",
  early: "Early career · up to 2 yrs",
  experienced: "Fake fresher · 2+ yrs asked",
  unclear: "Experience not stated",
};
export const MODES = ["onsite", "hybrid", "remote", "unknown"] as const;
export const EMPLOYMENTS = ["internship", "full_time", "contract", "apprenticeship"] as const;
