import type { PulseConfig } from "../config";
import type { NowPlayingTrack } from "../types";

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const NOW_PLAYING_ENDPOINT = "https://api.spotify.com/v1/me/player/currently-playing";
const RECENTLY_PLAYED_ENDPOINT = "https://api.spotify.com/v1/me/player/recently-played?limit=1";

export interface SpotifyProvider {
  getNowPlaying(): Promise<NowPlayingTrack | null>;
}

export class SpotifyAPI implements SpotifyProvider {
  constructor(
    private readonly config: PulseConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async getAccessToken(): Promise<string | null> {
    const { spotifyClientId, spotifyClientSecret, spotifyRefreshToken } = this.config;

    if (!spotifyClientId || !spotifyClientSecret || !spotifyRefreshToken) {
      return null;
    }

    const basic = btoa(`${spotifyClientId}:${spotifyClientSecret}`);
    const response = await this.fetchImpl(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: spotifyRefreshToken,
      }),
    });

    if (!response.ok) return null;
    const payload = await response.json() as { access_token?: string };
    return payload.access_token ?? null;
  }

  private mapTrack(track: {
    name: string;
    artists: Array<{ name: string }>;
    album: { name: string };
    external_urls: { spotify: string };
  }, isPlaying: boolean): NowPlayingTrack {
    return {
      isPlaying,
      title: track.name,
      artist: track.artists.map((artist) => artist.name).join(", "),
      album: track.album.name,
      url: track.external_urls.spotify,
    };
  }

  async getNowPlaying(): Promise<NowPlayingTrack | null> {
    const token = await this.getAccessToken();
    if (!token) return null;

    const authHeaders = { Authorization: `Bearer ${token}` };

    const nowPlayingResponse = await this.fetchImpl(NOW_PLAYING_ENDPOINT, {
      headers: authHeaders,
    });

    if (nowPlayingResponse.status === 200) {
      const payload = await nowPlayingResponse.json() as {
        is_playing?: boolean;
        item?: {
          name: string;
          artists: Array<{ name: string }>;
          album: { name: string };
          external_urls: { spotify: string };
        };
      };

      if (payload.item) {
        return this.mapTrack(payload.item, Boolean(payload.is_playing));
      }
    }

    const recentlyPlayedResponse = await this.fetchImpl(RECENTLY_PLAYED_ENDPOINT, {
      headers: authHeaders,
    });

    if (recentlyPlayedResponse.status !== 200) return null;

    const payload = await recentlyPlayedResponse.json() as {
      items?: Array<{
        track: {
          name: string;
          artists: Array<{ name: string }>;
          album: { name: string };
          external_urls: { spotify: string };
        };
      }>;
    };

    const track = payload.items?.[0]?.track;
    return track ? this.mapTrack(track, false) : null;
  }
}
