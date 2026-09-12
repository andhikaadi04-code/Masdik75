import { cp, mkdir } from "node:fs/promises"

await mkdir(new URL("./dist/assets/", import.meta.url), { recursive: true })
await cp(new URL("./assets/", import.meta.url), new URL("./dist/assets/", import.meta.url), { recursive: true })
