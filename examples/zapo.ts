import { SnowKitWhatsAppPlayer, ZapoRichHtmlSender } from "../src/index.js"

export async function sendWithZapo(provider: unknown, chatId: string, input: string, quote?: unknown) {
  const sender = new ZapoRichHtmlSender(provider as ConstructorParameters<typeof ZapoRichHtmlSender>[0])
  const player = new SnowKitWhatsAppPlayer(sender, {
    endpoint: process.env.SNOWKIT_ENDPOINT ?? "https://snow.kairogg.com.br",
    token: process.env.SNOWKIT_TOKEN!,
    market: "BR",
  })

  await player.send(chatId, input, quote)
}
