export type SectionId = 'work' | 'research' | 'purdue' | 'about' | 'contact' | 'building';
export type ContributionStatus = 'Open' | 'Merged' | 'Closed without merge';
export interface Contribution {
  number: number;
  title: string;
  url: string;
  status: ContributionStatus;
  author: string;
}
export interface FeaturedContribution extends Contribution {
  heading: string;
  problem: string;
  contribution: string;
  tags: string[];
  attribution?: string;
}

export const profile = {
  name: 'Srreyansh Sethi',
  initials: 'SS',
  siteUrl: 'https://worldexplored.github.io',
  lastVerified: '2026-09-13',
  edition: 'Aero Research Habitat',
  education: 'Purdue University · Data Science · 2029',
  degree: 'B.S. Data Science',
  university: 'Purdue University',
  graduation: 'Class of 2029',
  graduationYear: '2029',
  titleSuffix: 'ML Systems & GPU Performance',
  metaEvidence: 'Explore vLLM contributions and EMNLP research.',
  focus: 'ML systems. LLM inference. GPU performance.',
  intro: 'Working where performance meets correctness.',
  summary: 'I work on machine learning engineering and AI systems, from GPU kernels to reliable model serving.',
  showAvailability: true,
  availability: 'Seeking Summer 2027 internships in ML engineering, AI systems, and research engineering.',
  about: 'I’m a Data Science student at Purdue University, working at the boundary between performance and correctness. I reproduce systems bugs, reason about backend capabilities, validate GPU execution paths, and turn ambiguous failures into tested upstream changes.',
  technicalFocus: ['LLM inference', 'GPU performance', 'Compilation', 'Model serving', 'CUDA', 'Triton', 'Quantization', 'Performance validation', 'Failure-oriented testing'],
  building: 'Something new is taking shape. Details later.',
  additions: [] as { section: SectionId; title: string; description: string; url?: string; tags?: string[] }[],
  links: {
    github: 'https://github.com/WorldExplored',
    linkedin: 'https://www.linkedin.com/in/srreyansh-sethi-762264281/',
    paper: 'https://aclanthology.org/2024.findings-emnlp.16/',
    profile: 'https://github.com/WorldExplored/WorldExplored',
    contributions: 'https://github.com/vllm-project/vllm/pulls?q=is%3Apr+author%3AWorldExplored',
  },
  research: {
    title: 'Ukrainian Resilience: A Dataset for Detection of Help-Seeking Signals Amidst the Chaos of War',
    shortTitle: 'Ukrainian Resilience',
    coverVenue: 'EMNLP',
    year: '2024',
    coverSeries: 'FINDINGS',
    venue: 'Findings of EMNLP 2024',
    attribution: 'Co-authored by Msvpj Sathvik, Abhilash Dowpati, and Srreyansh Sethi.',
    description: 'A Ukrainian-language social-media dataset for identifying help-seeking signals during wartime. The work studies binary classification of posts that request help and those that do not.',
    role: 'My contributions included dataset construction, preprocessing, model evaluation, analysis, and manuscript writing.',
    tags: ['Natural language processing', 'Dataset construction', 'Model evaluation'],
  },
  sections: [
    { id: 'work', label: 'Work', title: 'Open-source work', landmark: 'GPU Observatory', number: '01', subtitle: 'Upstream changes, grounded in tests.', dock: true },
    { id: 'research', label: 'Research', title: 'Research', landmark: 'Research Lagoon', number: '02', subtitle: 'Language, data, and signals that matter.', dock: true },
    { id: 'purdue', label: 'Purdue', title: 'Purdue', landmark: 'Purdue Pavilion', number: '03', subtitle: 'A foundation in data science.', dock: true },
    { id: 'about', label: 'About', title: 'A little about me', number: '04', subtitle: 'Performance and correctness, together.', dock: true },
    { id: 'contact', label: 'Contact', title: 'Let’s connect', number: '05', subtitle: 'Find me around the web.', dock: true },
    { id: 'building', label: 'Building', title: 'Building', landmark: 'Distant Signal', number: '06', subtitle: '', dock: false },
  ] as { id: SectionId; label: string; title: string; landmark?: string; number: string; subtitle: string; dock: boolean }[],
  ui: {
    skip: 'Skip to the work',
    github: 'GitHub',
    linkedin: 'LinkedIn',
    paper: 'Read the paper',
    evidence: 'Explore vLLM contributions',
    researchEvidence: 'EMNLP 2024 paper',
    welcome: 'A small world of systems & ideas',
    explore: 'Choose a landmark. Follow a curiosity.',
    readOn: 'Or keep scrolling to read the work',
    guide: 'The field guide',
    guideTitle: 'A closer look at the work.',
    guideIntro: 'Selected contributions, published research, and the questions I work on.',
    contributions: 'Authored vLLM contribution log',
    source: 'View on GitHub',
    logNote: 'All pull requests authored by WorldExplored. Co-developed work is featured above.',
    topics: 'Technical topics',
    focusLabel: 'Technical focus',
    landscapeNavigation: 'Explore the habitat',
    mainNavigation: 'Main navigation',
    panelNavigation: 'Panel navigation',
    prUnit: 'PRs',
    projectLabel: 'vLLM',
    verified: 'Last verified',
    close: 'Close panel',
    minimize: 'Minimize panel',
    pause: 'Pause motion',
    resume: 'Resume motion',
    motion: 'Ambient motion',
    home: 'Return to habitat',
    contact: 'For opportunities and conversations about ML engineering, AI systems, and research engineering, connect with me on LinkedIn.',
    footer: 'Curiosity, with room to grow.',
  },
};

// Public GitHub snapshot; update with npm run sync:github.
// BEGIN GITHUB SNAPSHOT
export const contributions: Contribution[] = [
  {
    "number": 50096,
    "title": "[Kernel] Use expanding ldmatrix for Marlin W4A8",
    "url": "https://github.com/vllm-project/vllm/pull/50096",
    "author": "WorldExplored",
    "status": "Open"
  },
  {
    "number": 47100,
    "title": "[Bugfix] Resolve ModelOpt KV cache dtype",
    "url": "https://github.com/vllm-project/vllm/pull/47100",
    "author": "WorldExplored",
    "status": "Closed without merge"
  },
  {
    "number": 42847,
    "title": "[Usage][Pooling] Add input_type support for ColBERT query/document embeddings",
    "url": "https://github.com/vllm-project/vllm/pull/42847",
    "author": "WorldExplored",
    "status": "Closed without merge"
  },
  {
    "number": 40246,
    "title": "[torch.compile] refactor config hashing through compile_factors and normalization",
    "url": "https://github.com/vllm-project/vllm/pull/40246",
    "author": "WorldExplored",
    "status": "Closed without merge"
  },
  {
    "number": 40193,
    "title": "[Bugfix] Make Attention Backend Auto-Selection Batch-Invariance-Aware",
    "url": "https://github.com/vllm-project/vllm/pull/40193",
    "author": "WorldExplored",
    "status": "Merged"
  },
  {
    "number": 34762,
    "title": "[Bugfix]: Improving --kv-cache-dtype behavior when checkpoint specifies kv_cache_quant_algo",
    "url": "https://github.com/vllm-project/vllm/pull/34762",
    "author": "WorldExplored",
    "status": "Closed without merge"
  },
  {
    "number": 29046,
    "title": "[Feature]: Disable logging /metrics",
    "url": "https://github.com/vllm-project/vllm/pull/29046",
    "author": "WorldExplored",
    "status": "Closed without merge"
  },
  {
    "number": 28453,
    "title": "[Feature]: Implement naive prepare/finalize class to replace naive dispatching in fused_moe/layer.py",
    "url": "https://github.com/vllm-project/vllm/pull/28453",
    "author": "WorldExplored",
    "status": "Closed without merge"
  },
  {
    "number": 28443,
    "title": "[feat]: make DCP error msg clearer",
    "url": "https://github.com/vllm-project/vllm/pull/28443",
    "author": "WorldExplored",
    "status": "Merged"
  },
  {
    "number": 27516,
    "title": "[Frontend] Added chat-style multimodal support to /classify.",
    "url": "https://github.com/vllm-project/vllm/pull/27516",
    "author": "WorldExplored",
    "status": "Merged"
  },
  {
    "number": 26651,
    "title": "[compile] custom op unit test",
    "url": "https://github.com/vllm-project/vllm/pull/26651",
    "author": "WorldExplored",
    "status": "Closed without merge"
  }
];
export const featured: FeaturedContribution[] = [
  {
    "number": 50096,
    "title": "[Kernel] Use expanding ldmatrix for Marlin W4A8",
    "url": "https://github.com/vllm-project/vllm/pull/50096",
    "author": "WorldExplored",
    "status": "Open",
    "heading": "Expanding ldmatrix for Marlin W4A8",
    "problem": "Low-bit weights need an efficient path into integer matrix operations.",
    "contribution": "Added a CUDA 13.4+ expanding-load path for eligible Marlin W4A8 kernels, with layout probes and existing fallbacks preserved.",
    "tags": [
      "CUDA",
      "PTX",
      "GPU kernels",
      "Quantization"
    ]
  },
  {
    "number": 40193,
    "title": "[Bugfix] Make Attention Backend Auto-Selection Batch-Invariance-Aware",
    "url": "https://github.com/vllm-project/vllm/pull/40193",
    "author": "WorldExplored",
    "status": "Merged",
    "heading": "Batch-invariant attention selection",
    "problem": "Automatic backend selection could choose an implementation incompatible with batch invariance.",
    "contribution": "Made selection capability-aware across attention paths, with explicit compatibility checks and regression coverage.",
    "tags": [
      "Attention",
      "Model serving",
      "Correctness"
    ]
  },
  {
    "number": 26468,
    "title": "[torch.compile] caching of config fields should be opt-out by default",
    "url": "https://github.com/vllm-project/vllm/pull/26468",
    "author": "ghost",
    "status": "Merged",
    "heading": "Safer torch.compile configuration hashing",
    "problem": "New configuration fields could be omitted from compilation cache invalidation.",
    "contribution": "Co-developed opt-out hashing so new fields participate in cache keys unless explicitly excluded.",
    "tags": [
      "torch.compile",
      "Caching",
      "Configuration"
    ],
    "attribution": "co-developed"
  },
  {
    "number": 27516,
    "title": "[Frontend] Added chat-style multimodal support to /classify.",
    "url": "https://github.com/vllm-project/vllm/pull/27516",
    "author": "WorldExplored",
    "status": "Merged",
    "heading": "Chat-style multimodal /classify",
    "problem": "Classification requests could reject chat-style multimodal inputs.",
    "contribution": "Extended /classify to accept chat-style multimodal requests, including video_url, and aligned its input handling with related serving APIs.",
    "tags": [
      "Multimodal",
      "API design",
      "Model serving"
    ]
  },
  {
    "number": 28443,
    "title": "[feat]: make DCP error msg clearer",
    "url": "https://github.com/vllm-project/vllm/pull/28443",
    "author": "WorldExplored",
    "status": "Merged",
    "heading": "Clearer decode-context-parallel validation",
    "problem": "Incompatible attention backends could fail without a useful explanation of DCP requirements.",
    "contribution": "Added a direct validation message explaining the need for decode-time softmax LSE and pointing to backend configuration.",
    "tags": [
      "Validation",
      "Attention",
      "Failure-oriented testing"
    ]
  }
];
// END GITHUB SNAPSHOT
