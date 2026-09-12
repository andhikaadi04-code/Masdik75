import { SnowKit, type Song } from "@luanxdd/snowkit"
import { SnowKitPlayer, type ReadyPlayerSession } from "@luanxdd/snowkit/player"

export interface SnowKitConfig {
  endpoint: string
  token: string
  market?: string
}

export class SnowKitMusic {
  readonly #catalog: SnowKit
  readonly #player: SnowKitPlayer
  readonly #market: string

  constructor(config: SnowKitConfig) {
    const options = {
      baseUrl: config.endpoint,
      token: config.token,
    }

    this.#catalog = new SnowKit(options)
    this.#player = new SnowKitPlayer(options)
    this.#market = config.market ?? "BR"
  }

  async resolve(input: string): Promise<Song> {
    if (isSpotifyReference(input)) {
      return this.#catalog.catalog.resolve(input, { market: this.#market })
    }

    if (looksLikeUrl(input)) {
      throw new Error("unsupported_music_url")
    }

    const results = await this.#catalog.catalog.songs.search(input, {
      limit: 1,
      market: this.#market,
    })
    const song = results.data[0]

    if (!song) throw new Error("song_not_found")
    return song
  }

  ready(songId: string): Promise<ReadyPlayerSession> {
    return this.#player.ready(songId, {
      market: this.#market,
      intervalMs: 1_000,
      timeoutMs: 5 * 60_000,
    })
  }
}

function isSpotifyReference(input: string): boolean {
  const normalized = input.trim()

  if (/^spotify:(?:track|album):/iu.test(normalized)) return true

  try {
    const url = new URL(normalized)
    return url.protocol === "https:" && url.hostname.toLowerCase() === "open.spotify.com"
  } catch {
    return false
  }
}

function looksLikeUrl(input: string): boolean {
  try {
    new URL(input)
    return true
  } catch {
    return false
  }
}
