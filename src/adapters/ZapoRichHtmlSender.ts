import { createRichHtmlPayload, type RichHtmlOptions } from "../rich/RichHtmlPayload.js"

export interface ZapoLikeProvider {
  sendRawMessage(
    chatId: string,
    message: unknown,
    options?: { quote?: unknown },
  ): Promise<unknown>
}

export class ZapoRichHtmlSender {
  readonly #provider: ZapoLikeProvider

  constructor(provider: ZapoLikeProvider) {
    this.#provider = provider
  }

  send(chatId: string, options: RichHtmlOptions, quote?: unknown): Promise<unknown> {
    const raw = createRichHtmlPayload(options)
    return this.#provider.sendRawMessage(chatId, raw, quote ? { quote } : {})
  }
}
