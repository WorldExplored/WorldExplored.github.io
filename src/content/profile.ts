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
  lastVerified: '2026-09-14',
  edition: 'ML systems & open-source work',
  education: 'Purdue University · B.S. Data Science · Class of 2029',
  degree: 'B.S. Data Science',
  university: 'Purdue University',
  graduation: 'Class of 2029',
  graduationYear: '2029',
  titleSuffix: 'ML Systems & GPU Performance',
  metaEvidence: 'CUDA kernels, attention selection, compilation caching, and multimodal serving.',
  focus: 'ML systems. LLM inference. GPU performance.',
  heroContribution: 'ML systems & GPU performance',
  showAvailability: true,
  availability: 'Seeking Summer 2027 internships in ML engineering, AI systems, and research engineering.',
  about: 'Open-source contributor to vLLM.',
  building: 'Building something impactful...',
  additions: [] as { section: SectionId; title: string; description: string; url?: string; tags?: string[] }[],
  links: {
    email: 'mailto:sethi64@purdue.edu',
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
    role: 'I contributed to dataset construction, preprocessing, model evaluation, analysis, and manuscript writing.',
    tags: ['Natural language processing', 'Dataset construction', 'Model evaluation'],
  },
  sections: [
    { id: 'work', label: 'Open source', title: 'Open-source work', dock: true },
    { id: 'research', label: 'Research', title: 'Research', dock: true },
    { id: 'purdue', label: 'Purdue', title: 'Purdue', dock: true },
    { id: 'about', label: 'About', title: 'About', dock: true },
    { id: 'contact', label: 'Contact', title: 'Contact', dock: true },
    { id: 'building', label: 'Building something impactful...', title: 'Building something impactful...', dock: false },
  ] as { id: SectionId; label: string; title: string; dock: boolean }[],
  ui: {
    skip: 'Open-source work', github: 'GitHub', linkedin: 'LinkedIn', email: 'Email',
    paper: 'Read the paper', researchEvidence: 'EMNLP 2024 co-author',
    source: 'GitHub profile', topics: 'Topics', projectLabel: 'vLLM',
    landscapeNavigation: 'Destinations in the world', mainNavigation: 'Main navigation',
    close: 'Close', home: 'Return to overview',
    travel: 'Opening', rotate: 'Rotate reflective sculpture',
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
    "contribution": "Added a CUDA 13.4+ expanding-load path for eligible Marlin W4A8 kernels, while preserving existing fallbacks.",
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

export const publicContributions = featured.filter(item => item.status === 'Open' || item.status === 'Merged');
