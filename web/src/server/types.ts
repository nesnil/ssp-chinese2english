export type Question = {
  id: string;
  season: number;
  day: number;
  questionNo: number;
  chinese: string;
  prompt: string;
  sourceText: string;
  referenceAnswer: string;
};

export type SeasonSummary = {
  season: number;
  title: string;
  dayCount: number;
  questionCount: number;
  days: Array<{ day: number; questionCount: number }>;
};

export type QuestionBank = {
  version: number;
  generatedAt: string;
  totalSeasons: number;
  totalDays: number;
  totalQuestions: number;
  seasons: SeasonSummary[];
  questions: Question[];
};

export type GradeResult = {
  score: number;
  level: string;
  encouragement: string;
  issues: string[];
  suggestion: string;
  improvedAnswer: string;
  referenceAnswer: string;
  needsReview: boolean;
  rawAi?: string;
  errorSummary?: string;
};

export type AiModelConfig = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  timeoutMs: number;
};

export type AiModelSettings = AiModelConfig & {
  configured: boolean;
  updatedAt: string | null;
};

export type TtsProvider = "openai-compatible" | "volcengine";

export type TtsSettings = {
  provider: TtsProvider;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  voice?: string;
  format: string;
  timeoutMs: number;
  appId?: string;
  accessToken?: string;
  cluster?: string;
  voiceType?: string;
  encoding?: string;
  configured: boolean;
  updatedAt: string | null;
};

export type TtsSettingsInput = {
  provider: TtsProvider;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  voice?: string;
  format?: string;
  timeoutMs?: number;
  appId?: string;
  accessToken?: string;
  cluster?: string;
  voiceType?: string;
  encoding?: string;
};

export type WalletSettings = {
  rewardScore: number;
  rewardMinCents: number;
  rewardMaxCents: number;
  penaltyScoreBelow: number;
  penaltyMinCents: number;
  penaltyMaxCents: number;
  withdrawThresholdCents: number;
  seniorWordRewardAverageAbove: number;
  seniorWordPenaltyAverageBelow: number;
  updatedAt: string | null;
};

export type WalletChange = {
  change: number;
  balance: number;
  reason: "perfect" | "fail" | null;
};

export type WordDefinition = {
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
};

export type WordExample = {
  english: string;
  chinese: string;
};

export type WordEntry = {
  id: string;
  sourceId: string;
  name: string;
  sortIndex: number;
  definitions: WordDefinition[];
  examples: WordExample[];
  similar: Array<{ id: string; name: string }>;
  tags: string[];
  audioPath: string | null;
};

export type WordTagSummary = {
  id: string;
  label: string;
  systemGenerated: boolean;
  count: number;
};

export type WordBank = {
  version: number;
  generatedAt: string;
  source: string;
  zhongkao?: {
    source: string;
    extractedWordRows: number;
    matchedSourceRows: number | null;
    unmatchedSourceRows: number | null;
  };
  totalWords: number;
  totalAudioFiles: number;
  missingAudio: string[];
  tags: WordTagSummary[];
  words: WordEntry[];
};

export type AppConfig = {
  port: number;
  databasePath: string;
  wordAudioRoot?: string;
  appPassword?: string;
  adminPassword?: string;
  sessionSecret?: string;
  siriApiToken?: string;
  deepseekBaseUrl?: string;
  deepseekApiKey?: string;
  deepseekModel?: string;
  ttsProvider?: string;
  ttsBaseUrl?: string;
  ttsApiKey?: string;
  ttsModel?: string;
  ttsVoice?: string;
  ttsFormat?: string;
  ttsAppId?: string;
  ttsAccessToken?: string;
  ttsCluster?: string;
  ttsVoiceType?: string;
  ttsEncoding?: string;
  ttsTimeoutMs: number;
  wordAudioGeneratedDir: string;
  aiTimeoutMs: number;
  reviewScoreThreshold: number;
  nodeEnv: string;
};
