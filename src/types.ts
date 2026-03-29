export interface NowPlayingTrack {
  isPlaying: boolean;
  title: string;
  artist: string;
  album: string;
  url: string;
}

export interface ContributionDay {
  date: string;
  contributionCount: number;
  contributionLevel: string;
}

export interface ContributionWeek {
  contributionDays: ContributionDay[];
}

export interface ContributionGraph {
  weeks: ContributionWeek[];
  totalContributions: number;
}

export interface ResponseMeta {
  cached: boolean;
  generatedAt: string;
  ttlSeconds: number;
}

export interface Clock {
  now(): number;
}
