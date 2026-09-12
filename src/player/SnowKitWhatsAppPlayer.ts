import type { Song } from "@luanxdd/snowkit"

import type { RichHtmlOptions } from "../rich/RichHtmlPayload.js"
import { SnowKitMusic } from "../snowkit/SnowKitClient.js"
import { inlineArtwork } from "./Artwork.js"
import { buildPlayerHtml } from "./PlayerHtml.js"

export interface RichSender {
  send(chatId: string, options: RichHtmlOptions, quote?: unknown): Promise<unknown>
}

export interface PlayerServiceConfig {
  endpoint: string
  token: string
  market?: string
}

export class SnowKitWhatsAppPlayer {
  readonly #music: SnowKitMusic
  readonly #sender: RichSender

  constructor(sender: RichSender, config: PlayerServiceConfig) {
    this.#sender = sender
    this.#music = new SnowKitMusic(config)
  }

  async send(chatId: string, input: string, quote?: unknown): Promise<void> {
    const song = await this.#music.resolve(input)
    const session = await this.#music.ready(song.id)
    const artist = artistNames(song)
    const artwork = await inlineArtwork(artworkUrl(song))
    const html = await buildPlayerHtml({
      title: song.title,
      artist,
      durationMs: session.audio.durationMs ?? song.durationMs,
      socketUrl: session.audio.socketUrl,
      mimeType: session.audio.contentType,
      imageDataUrl: artwork,
      lyrics: session.lyrics.lines,
    })

    await this.#sender.send(
      chatId,
      {
        html,
        title: `🎵 ${song.title} — ${artist}`,
        id: "dyno-music-player",
        disclaimer: "Dyno Player",
        trustedSources: [],
      },
      quote,
    )
  }
}

function artistNames(song: Song): string {
  return song.artists.map((artist) => artist.name).join(", ") || "artista desconhecido"
}

function artworkUrl(song: Song): string | undefined {
  return song.artwork?.url ?? song.album?.images[0]?.url
}
