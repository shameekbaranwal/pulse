import type { PulseConfig } from "../config";
import type { ContributionGraph } from "../types";

const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

export interface GithubProvider {
  getContributions(username: string, days: number): Promise<ContributionGraph | null>;
}

export class GithubAPI implements GithubProvider {
  constructor(
    private readonly config: PulseConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async getContributions(username: string, days: number): Promise<ContributionGraph | null> {
    if (!this.config.githubToken) return null;

    const from = new Date();
    from.setDate(from.getDate() - days);

    const query = `
      query($username: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $username) {
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                  contributionLevel
                }
              }
            }
          }
        }
      }
    `;

    const response = await this.fetchImpl(GITHUB_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.githubToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          username,
          from: from.toISOString(),
          to: new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) return null;

    const payload = await response.json() as {
      data?: {
        user?: {
          contributionsCollection?: {
            contributionCalendar?: ContributionGraph;
          };
        };
      };
    };

    return payload.data?.user?.contributionsCollection?.contributionCalendar ?? null;
  }
}
