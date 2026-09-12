import { readFile } from "node:fs/promises"

export interface PlayerHtmlInput {
  title: string
  artist: string
  durationMs: number | null
  socketUrl: string
  mimeType: string
  imageDataUrl?: string
  lyrics: readonly {
    startMs: number
    endMs: number | null
    text: string
  }[]
}

export async function buildPlayerHtml(input: PlayerHtmlInput): Promise<string> {
  const [template, styles, script] = await Promise.all([
    asset("player.html"),
    asset("player.css"),
    asset("player.js"),
  ])

  const title = escapeHtml(input.title || "Unknown")
  const artist = escapeHtml(input.artist || "Unknown")
  const image = input.imageDataUrl ?? ""
  const cover = image
    ? `<img class="player-cover" src="${escapeHtml(image)}" alt="${title}">`
    : `<div class="player-cover"></div>`
  const backdrop = image
    ? `<img class="player-backdrop-image" src="${escapeHtml(image)}" alt="">`
    : ""

  const data = safeJson({
    socketUrl: input.socketUrl,
    mimeType: input.mimeType || "audio/mp4",
    lyrics: input.lyrics.map((line) => ({
      start_ms: line.startMs,
      end_ms: line.endMs,
      text: line.text,
    })),
  })

  const body = template
    .replaceAll("{{BACKDROP}}", backdrop)
    .replaceAll("{{COVER}}", cover)
    .replaceAll("{{TITLE}}", title)
    .replaceAll("{{ARTIST}}", artist)
    .replaceAll("{{DURATION}}", formatDuration(input.durationMs))

  return `<style>\n${styles}\n</style>\n${body}\n<script>window.__SNOWKIT_PLAYER__=${data}</script>\n<script>\n${script}\n</script>`
}

async function asset(name: string): Promise<string> {
  const url = new URL(`../../assets/${name}`, import.meta.url)
  return readFile(url, "utf8")
}

function formatDuration(durationMs: number | null): string {
  const total = Math.max(0, Math.floor((durationMs ?? 0) / 1_000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
}
