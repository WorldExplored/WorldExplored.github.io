export type SectionId = 'work' | 'experience' | 'research' | 'purdue' | 'history' | 'about' | 'contact' | 'building';
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
  why: string;
  contribution: string;
  validation: string;
  currentStatus: string;
  tags: string[];
  attribution?: string;
}

export interface BackgroundMusicTrack { title: string; artist: string; playbackUrl: string }

export const profile = {
  entry: {
    eyebrow: 'A little closer to the future we imagined.',
    title: 'Travel back to the future.',
    description: 'An island of ideas, open-source work, and things still to discover.',
    sound: 'Music & coastal ambience',
    enter: 'Enter the world',
    hint: 'Drag to explore · Choose a building to step inside',
  },
  soundSettings: {
    label: 'Sound', group: 'Environmental ambience', ambience: 'Ambience', volume: 'Ambience volume', credits: 'Sound credits',
    unavailable: 'Coastal audio unavailable. Try again.', bellUnavailable: 'Bell audio unavailable. Try again.',
  },
  soundtrack: {
    audioTracks: [] as readonly BackgroundMusicTrack[],
    player: 'World music player', track: 'Track', retry: 'Play music',
    states: { preparing: 'Preparing music…', ready: 'Ready', loading: 'Starting music…', playing: 'Playing', paused: 'Paused', blocked: 'Tap Play music to start playback.', unavailable: 'Music could not load. Try again.' },
    settings: 'Music', volume: 'Music volume', trackUnavailable: 'unavailable', external: 'Listen on YouTube',
    source: 'Your inspiration mix', reference: 'https://www.youtube.com/watch?v=Cz2YCRmDOFk',
    tracks: [
      { title: 'LEASE', artist: 'Takeshi Abo', videoId: 'tjlvmb8SGEs' },
      { title: 'New Look (Wii U Mii Maker Lofi Mix)', artist: 'Secret Potion', videoId: 'P15Ldd_lSEM' },
    ],
  },
  name: 'Srreyansh Sethi',
  initials: 'SS',
  siteUrl: 'https://worldexplored.github.io',
  lastVerified: '2026-09-16',
  edition: 'ML systems & open-source work',
  education: 'Data Science student at Purdue University',
  degree: 'Data Science student',
  university: 'Purdue University',
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
    linkedin: 'https://www.linkedin.com/in/srreyanshsethi/',
    paper: 'https://aclanthology.org/2024.findings-emnlp.16/',
    trafficPaper: 'https://terra-docs.s3.us-east-2.amazonaws.com/IJHSR/Articles/volume6-issue4/IJHSR_2024_64_99.pdf',
    profile: 'https://github.com/WorldExplored/WorldExplored',
    contributions: 'https://github.com/vllm-project/vllm/pulls?q=is%3Apr+author%3AWorldExplored',
  },
  experience: [
    { company: 'Air Labs', role: '', dates: 'Present', location: '', details: ['Currently working at Air Labs.'] },
  ],
  research: [
    {
      title: 'Ukrainian Resilience: A Dataset for Detection of Help-Seeking Signals Amidst the Chaos of War',
      shortTitle: 'Ukrainian Resilience',
      coverVenue: 'EMNLP',
      year: '2024',
      coverSeries: 'FINDINGS',
      venue: 'Findings of EMNLP 2024',
      attribution: 'Co-authored by Msvpj Sathvik, Abhilash Dowpati, and Srreyansh Sethi.',
      description: 'A Ukrainian-language social-media dataset for identifying help-seeking signals during wartime. The work studies binary classification of posts that request help and those that do not.',
      role: 'I contributed to dataset construction, preprocessing, model evaluation, analysis, and manuscript writing.',
      question: 'Can Ukrainian-language social posts be classified for subtle signals that a person is seeking help during the Russia–Ukraine war?',
      setup: 'The paper introduces a binary dataset of Ukrainian social-media posts labeled as requiring help or not requiring help, then evaluates baseline language-processing and machine-learning approaches.',
      methods: 'Dataset construction and preprocessing were paired with baseline classification experiments, including GPT-3.5.',
      findings: 'The paper reports 81.15% accuracy for GPT-3.5 on the dataset’s binary classification task.',
      limitations: 'The dataset and baselines establish an initial task; broader validation across platforms, time periods, dialects, and real humanitarian response settings remains necessary.',
      tags: ['Natural language processing', 'Dataset construction', 'Model evaluation'],
      url: 'https://aclanthology.org/2024.findings-emnlp.16/',
    },
    {
      title: 'AI Reinforcement Learning Traffic System Implementations and Limitations',
      shortTitle: 'Reinforcement Learning Traffic Systems',
      coverVenue: 'IJHSR',
      year: '2024',
      coverSeries: 'TRAFFIC SYSTEMS',
      venue: 'International Journal of High School Research, 2024',
      attribution: 'Research by Srreyansh Sethi.',
      description: 'I investigated how MaxPressure, DQN, PPO, and PPO_PFRL behaved across CityFlow and LibSignal road networks. Ninety-nine simulation runs compared throughput, travel time, and computation time while testing reward, resize, control, and hyperparameter changes.',
      role: 'I configured and ran the comparative simulations, tested baseline and modified agent variants, and analyzed throughput, total travel time, and computation-time results across the road networks.',
      question: 'How do classical and reinforcement-learning traffic-signal agents respond to reward, sizing, control, and hyperparameter changes across simulated road networks?',
      setup: 'Ninety-nine LibSignal and CityFlow simulations covered road networks representing New York, Hangzhou, and other labeled cities, tracking throughput, total travel time, and computation time.',
      methods: 'The study compared MaxPressure, DQN, PPO, and PPO_PFRL baselines and modified variants, including reward, resize, control, and combined changes.',
      findings: 'Modified DQN produced the highest tested throughput; among unchanged agents, MaxPressure remained strongest. PPO-family experiments showed stability and compute tradeoffs that changed with the modification and road layout.',
      limitations: 'The paper calls for stronger comparison of interacting modifications, robustness under changing traffic and simulator parameters, larger metropolitan networks, and validation against real traffic data and signal systems.',
      tags: ['Reinforcement learning', 'Traffic simulation', 'Comparative evaluation'],
      url: 'https://terra-docs.s3.us-east-2.amazonaws.com/IJHSR/Articles/volume6-issue4/IJHSR_2024_64_99.pdf',
    },
  ],
  historyMilestones: [
    { date: 'Current', title: 'Air Labs', description: 'Currently working at Air Labs.', href: '#experience' },
    {
      date: 'Current',
      title: 'Open-source ML systems work',
      description: 'Tracing GPU kernel paths, attention capability selection, compilation cache correctness, multimodal serving requests, and failure diagnostics in vLLM pull requests.',
      href: '#work',
    },
    {
      date: 'Current',
      title: 'Purdue University',
      description: 'Data Science student at Purdue University.',
      href: '#purdue',
    },
    {
      date: '2024',
      title: 'Ukrainian Resilience',
      description: 'Constructed and evaluated a Ukrainian-language help-seeking classification dataset with preprocessing, baseline experiments, analysis, and manuscript work; published in Findings of EMNLP 2024.',
      href: 'https://aclanthology.org/2024.findings-emnlp.16/',
    },
    {
      date: '2024',
      title: 'AI Reinforcement Learning Traffic System Implementations and Limitations',
      description: 'Ran a comparative traffic-signal study across MaxPressure, DQN, PPO, and PPO_PFRL variants in LibSignal and CityFlow; published in the International Journal of High School Research.',
      href: 'https://terra-docs.s3.us-east-2.amazonaws.com/IJHSR/Articles/volume6-issue4/IJHSR_2024_64_99.pdf',
    },
  ],
  history: [
    {
      organization: 'Computer Science Club',
      role: 'Co-President',
      school: 'Mission Valley ROP',
      dates: 'September 2023 – May 2025',
      description: 'Organized programming activities and projects, including Python maze navigation and a Python Turtle game.',
    },
    {
      organization: 'High School Artificial Intelligence Club',
      role: 'President',
      school: 'Mission Valley ROP',
      dates: 'September 2023 – May 2025',
      description: 'Organized AI discussions, after-school hackathons, and projects involving language models and image analysis.',
    },
    {
      organization: 'Game Development Club',
      role: 'Treasurer',
      school: 'American High School',
      dates: '',
      description: '',
    },
  ],
  sections: [
    { id: 'work', label: 'Open source', title: 'Open-source work', dock: true },
    { id: 'experience', label: 'Experience', title: 'Experience', dock: true },
    { id: 'research', label: 'Research', title: 'Research', dock: true },
    { id: 'purdue', label: 'Purdue', title: 'Purdue', dock: true },
    { id: 'history', label: 'History', title: 'History', dock: true },
    { id: 'about', label: 'About', title: 'About', dock: true },
    { id: 'contact', label: 'Contact', title: 'Contact', dock: true },
    { id: 'building', label: 'Building something impactful...', title: 'Building something impactful...', dock: false },
  ] as { id: SectionId; label: string; title: string; dock: boolean }[],
  researchLabels: { description: 'Overview', question: 'Question', setup: 'Data and setup', methods: 'Methods', role: 'My contribution', findings: 'Findings', limitations: 'Limitations' },
  ui: {
    skip: 'Open-source work', github: 'GitHub', linkedin: 'LinkedIn', email: 'Email',
    paper: 'Read the paper', researchEvidence: '2 published research papers',
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
    "why": "Marlin’s W4A8 kernels repeatedly load signed 4-bit weight fragments before 8-bit matrix operations; a native expanding load can remove conversion work on GPUs that support PTX 9.4.",
    "contribution": "Added a CUDA 13.4+ expanding-load path for eligible Marlin W4A8 kernels, while preserving existing fallbacks.",
    "validation": "Added x1, x2, and x4 instruction probes, exercised two x4 loads in eligible kernels, ran focused H100 and A100 coverage, and passed the project’s pre-commit checks reported in the pull request.",
    "currentStatus": "Open as of September 16, 2026. The path is gated to supported SM90, SM100, SM107, SM110, and SM120 targets; unsupported and activation-order cases keep the established fallback.",
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
    "why": "A backend that changes numerical behavior with batch composition can violate a model’s explicit batch-invariance requirement.",
    "contribution": "Made selection capability-aware across attention paths, with explicit compatibility checks and regression coverage.",
    "validation": "Added nine determinism cases, eight selector cases, explicit unsupported-backend validation, Mamba-path coverage, and an H100 smoke test.",
    "currentStatus": "Merged on April 23, 2026. Automatic selection now chooses the highest-priority compatible backend, while an explicitly requested incompatible backend fails with a direct explanation.",
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
    "why": "A stale compilation cache key can reuse generated work after a configuration change that should have produced a different compiled graph.",
    "contribution": "Co-developed opt-out hashing so new fields participate in cache keys unless explicitly excluded.",
    "validation": "Updated the configuration, cache, and compilation paths together and added configuration tests covering the opt-out behavior.",
    "currentStatus": "Merged on November 19, 2025. This is presented as co-developed work because the merged pull request has shared authorship.",
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
    "why": "Clients using chat-shaped content needed classification to accept the same multimodal request style used by adjacent serving APIs.",
    "contribution": "Extended /classify to accept chat-style multimodal requests, including video_url, and aligned its input handling with related serving APIs.",
    "validation": "Updated serving protocol and endpoint tests and added smoke coverage for message-shaped multimodal classification requests.",
    "currentStatus": "Merged on November 14, 2025. The endpoint accepts either direct input or chat-style messages while retaining the established classification response path.",
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
    "why": "Decode context parallelism requires decode-time softmax LSE support, so a late or opaque failure makes backend configuration unnecessarily difficult to diagnose.",
    "contribution": "Added a direct validation message explaining the need for decode-time softmax LSE and pointing to backend configuration.",
    "validation": "Moved the check into the worker’s context-parallel validation path and added regression coverage for the incompatible-backend error.",
    "currentStatus": "Merged on April 10, 2026. This is a diagnostics and validation change; it does not claim a kernel-speed improvement.",
    "tags": [
      "Validation",
      "Attention",
      "Failure-oriented testing"
    ]
  }
];
// END GITHUB SNAPSHOT

export const publicContributions = featured.filter(item => item.status === 'Open' || item.status === 'Merged');
