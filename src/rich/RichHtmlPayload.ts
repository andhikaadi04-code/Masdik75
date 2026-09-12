import { randomUUID } from "node:crypto"

export interface RichHtmlOptions {
  html: string
  title: string
  id?: string
  disclaimer?: string
  trustedSources?: readonly string[]
  botJid?: string
}

export function createRichHtmlPayload(options: RichHtmlOptions): Record<string, unknown> {
  const html = options.html.trim()
  const title = options.title.trim()

  if (!html || !title) throw new Error("Rich HTML exige HTML e título não vazios.")

  const responseId = `${options.id?.trim() || "snowkit-player"}-${randomUUID()}`
  const trustedSources = [...new Set((options.trustedSources ?? ["snowkit"]).filter(Boolean))]
  const unified = {
    __typename: "GenAIUnifiedResponse",
    response_id: responseId,
    sections: [
      {
        __typename: "GenAIUnifiedResponseSection",
        view_model: {
          __typename: "GenAISingleLayoutViewModel",
          primitive: {
            __typename: "GenAIaeacdsnwHtmlPrimitive",
            payload: html,
            trusted_sources: trustedSources,
          },
        },
      },
    ],
  }

  return {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: {
        messageDisclaimerText: options.disclaimer ?? "",
        botResponseId: responseId,
      },
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages: [{ messageType: 2, messageText: title }],
          unifiedResponse: {
            data: Buffer.from(JSON.stringify(unified), "utf8").toString("base64"),
          },
          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botJid: options.botJid ?? "867051314767696@bot",
            },
            forwardOrigin: 4,
          },
        },
      },
    },
  }
}
