import sharp from "sharp"

const maxArtworkBytes = 8 * 1024 * 1024
const artworkSize = 640

export async function inlineArtwork(url: string | undefined): Promise<string> {
  if (!url) return ""

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent": "SnowKitPlayer/1.0",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) return ""

    const contentLength = Number(response.headers.get("content-length") ?? 0)
    if (contentLength > maxArtworkBytes) return ""

    const input = Buffer.from(await response.arrayBuffer())
    if (!input.length || input.length > maxArtworkBytes) return ""

    const image = await sharp(input, { failOn: "none" })
      .rotate()
      .resize(artworkSize, artworkSize, { fit: "cover" })
      .webp({ quality: 82, effort: 5 })
      .toBuffer()

    return `data:image/webp;base64,${image.toString("base64")}`
  } catch {
    return ""
  }
}
