import { CategoryDefinition } from "../types";

// Per-source defaults: parseRule is "directPosting" and carriesApplication is
// true unless the source says otherwise. Only the exceptions are annotated.
//
// Removed 2026-10-08 after the page-calibration sweep:
//   remote_ok    remoteok.com retired /remote-jobs.rss, answers HTTP 410. It still
//                has a JSON API at remoteok.com/api if you want it back; needs a new type.
//   techstars_news  www.techstars.com does not resolve at all.
//   wwr_contract weworkremotely.com returns a 301 with no Location header.
export const CATEGORIES: CategoryDefinition[] = [
  // 1. Grants & Fellowships
  {
    id: "grants_fellowships",
    displayName: "Grants & Fellowships",
    icon: "💰",
    routeTo: "application",
    sources: [
      {
        id: "od_grants",
        name: "Opportunity Desk - Grants",
        url: "https://opportunitydesk.org/category/grants/feed/"
      },
      {
        id: "od_fellowships",
        name: "Opportunity Desk - Fellowships",
        url: "https://opportunitydesk.org/category/fellowships/feed/"
      },
      {
        id: "opps_for_africans",
        name: "Opportunities for Africans",
        url: "https://www.opportunitiesforafricans.com/feed/"
      },
      {
        id: "funds_for_ngos",
        name: "FundsforNGOs",
        url: "https://fundsforngos.org/feed/"
      }
    ],
    keywords: {
      include: [
        /\b(grant|fellowship|funding|award|stipend|subsidy)\b/i,
        /\b(ai|artificial intelligence|technology|policy|governance|safety)\b/i,
        /\b(africa|nigeria|global|developing countries|emerging)\b/i,
        /\b(social impact|climate|research|innovation|civic)\b/i
      ],
      exclude: [
        /\b(high school only|undergraduate only|kids competition)\b/i
      ]
    }
  },

  // 2. Scholarships
  {
    id: "scholarships",
    displayName: "Scholarships",
    icon: "🎓",
    routeTo: "application",
    sources: [
      {
        id: "od_scholarships",
        name: "Opportunity Desk - Scholarships",
        url: "https://opportunitydesk.org/category/scholarships/feed/"
      },
      {
        id: "afterschool_africa",
        name: "AfterSchoolAfrica - Scholarships",
        url: "https://www.afterschoolafrica.com/category/scholarship/feed/"
      }
    ],
    keywords: {
      include: [
        /\b(scholarship|masters|master's|phd|postgraduate|doctoral)\b/i,
        /\b(fully funded|tuition waiver|living allowance|stipend)\b/i,
        /\b(erasmus|chevening|fulbright|rhodes|daad|commonwealth)\b/i,
        /\b(africa|international students|nigeria)\b/i
      ],
      exclude: [
        /\b(primary school|kindergarten|secondary school)\b/i
      ]
    }
  },

  // 3. Competitions, Hackathons & Pitches
  {
    id: "competitions_hackathons",
    displayName: "Competitions, Hackathons & Pitches",
    icon: "⚡",
    routeTo: "application",
    sources: [
      {
        id: "od_competitions",
        name: "Opportunity Desk - Competitions",
        url: "https://opportunitydesk.org/category/competitions/feed/"
      },
      {
        id: "od_pitches",
        name: "Opportunity Desk - Pitches",
        url: "https://opportunitydesk.org/category/calls-for-pitches/feed/"
      }
    ],
    keywords: {
      include: [
        /\b(hackathon|competition|pitch|challenge|contest|prize|demo day)\b/i,
        /\b(ai|build|builder|innovate|coder|developer|founder)\b/i,
        /\b(cash prize|\$\d+|\bgrant prize\b)\b/i
      ],
      exclude: [
        /\b(children|essay contest for primary)\b/i
      ]
    }
  },

  // 4. Angel & Startup Funding
  {
    id: "angel_startup_funding",
    displayName: "Angel & Startup Funding",
    icon: "🚀",
    routeTo: "none",
    sources: [
      {
        id: "disrupt_africa",
        name: "Disrupt Africa - Funding",
        url: "https://disruptafrica.com/feed/",
        carriesApplication: false
      },
      {
        id: "vc_cafe",
        name: "VC Cafe",
        url: "https://www.vccafe.com/feed/",
        carriesApplication: false
      },
      {
        id: "eu_startups",
        name: "EU-Startups",
        url: "https://www.eu-startups.com/feed/",
        carriesApplication: false
      },
      {
        id: "founders_you_should_know",
        name: "Founders You Should Know",
        url: "https://newsletter.foundersysk.com/feed",
        carriesApplication: false
      },
      {
        id: "breakout_list",
        name: "Breakout List",
        url: "https://breakoutlist.com",
        type: "html",
        carriesApplication: false
      },
      {
        id: "ramp_builders",
        name: "Ramp Builders & Spend",
        url: "https://builders.ramp.com/rss.xml",
        carriesApplication: false
      }
    ],
    keywords: {
      include: [
        /\b(angel|pre-seed|seed|funding|accelerator|incubator|venture capital|vc)\b/i,
        /\b(call for applications|applications open|cohort|pitch to investors)\b/i,
        /\b(startup|founders|equity|capital|fund|investment|breakout|series a|series b)\b/i,
        /\b(africa|fintech|ai|climate tech|saas|healthtech)\b/i
      ],
      exclude: [
        /\b(crypto scam|airdrop pump|meme coin)\b/i
      ]
    }
  },

  // 5. Freelance Opportunities, Gigs & Contracts
  {
    id: "freelance_gigs",
    displayName: "Freelance, Gigs & Contracts",
    icon: "🛠️",
    routeTo: "cold_email",
    sources: [
      {
        id: "problogger",
        name: "ProBlogger Jobs",
        url: "https://problogger.com/jobs/feed/"
      },
      {
        id: "remotive",
        name: "Remotive - All Jobs",
        url: "https://remotive.com/remote-jobs/feed"
      },
      {
        id: "hn_freelance",
        name: "HN Seeking Freelancer",
        url: "https://hnrss.org/whoishiring/freelance",
        parseRule: "hnComment"
      }
    ],
    keywords: {
      include: [
        /\b(contract|contractor|freelance|consultant|gig|part-time|hourly)\b/i,
        /\b(ai|python|fullstack|frontend|backend|developer|prompt engineer)\b/i,
        /\b(writer|technical writer|researcher|content|marketing)\b/i
      ],
      exclude: [
        /\b(unpaid internship|commission only)\b/i
      ]
    }
  },

  // 6. Remote Jobs
  {
    id: "remote_jobs",
    displayName: "Remote Tech & Product Jobs",
    icon: "🌍",
    routeTo: "cold_email",
    sources: [
      {
        id: "yc_jobs",
        name: "Y Combinator & HN Jobs",
        url: "https://hnrss.org/jobs",
        parseRule: "hnComment"
      },
      {
        id: "hn_who_is_hiring",
        name: "Hacker News - Who's Hiring",
        url: "https://hnrss.org/whoishiring/jobs",
        parseRule: "hnComment"
      },
      {
        id: "lennys_jobs",
        name: "Lenny's Jobs & Newsletter",
        url: "https://www.lennysnewsletter.com/feed"
      },
      {
        id: "a16z_build",
        name: "a16z Build & Jobs (Cosign)",
        url: "https://a16zjobs.substack.com/feed"
      },
      {
        id: "next_play",
        name: "Next Play Newsletter",
        url: "https://nextplayso.substack.com/feed"
      },
      {
        id: "wwr_programming",
        name: "We Work Remotely - Programming",
        url: "https://weworkremotely.com/categories/remote-programming-jobs.rss"
      },
      {
        id: "wwr_product",
        name: "We Work Remotely - Product",
        url: "https://weworkremotely.com/categories/remote-product-jobs.rss"
      },
      {
        id: "somewhere_jobs",
        name: "Somewhere.com Jobs",
        url: "https://somewhere.com/jobs",
        type: "json"
      },
      {
        id: "jobspresso",
        name: "Jobspresso",
        url: "https://jobspresso.co/feed/"
      }
    ],
    keywords: {
      include: [
        /\b(remote|anywhere|worldwide|global|emea|latam|africa|south africa)\b/i,
        /\b(product manager|product management|pm|project manager)\b/i,
        /\b(ai engineer|machine learning|llm|software engineer|developer|founding engineer)\b/i,
        /\b(credit|risk|fintech|banking|underwriting|operations|growth|chief of staff|analyst|controller|assistant|drafter)\b/i,
        /\b(policy|compliance|governance|ethics)\b/i
      ],
      exclude: [
        /\b(us only|must reside in us|hybrid|on-site|office only)\b/i
      ]
    }
  }
];
