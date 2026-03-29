import { loadConfig } from "./config";
import { GithubAPI } from "./providers/github";
import { SpotifyAPI } from "./providers/spotify";
import { createPulseServer } from "./server";

const config = loadConfig();
const app = createPulseServer({
  config,
  spotify: new SpotifyAPI(config),
  github: new GithubAPI(config),
});

Bun.serve({
  port: config.port,
  fetch: app.fetch,
});

console.log(`pulse listening on http://localhost:${config.port}`);
