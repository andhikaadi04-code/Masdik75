(() => {
  const audio = document.getElementById("player-audio")
  const playButton = document.getElementById("player-play")
  const rewindButton = document.getElementById("player-rewind")
  const forwardButton = document.getElementById("player-forward")
  const progressBar = document.getElementById("player-progress")
  const progressFill = document.getElementById("player-progress-fill")
  const progressThumb = document.getElementById("player-progress-thumb")
  const currentTimeLabel = document.getElementById("player-current-time")
  const durationLabel = document.getElementById("player-duration")
  const favoriteButton = document.getElementById("player-favorite")
  const playIcon = document.getElementById("player-play-icon")
  const pauseIcon = document.getElementById("player-pause-icon")
  const lyricsContainer = document.getElementById("player-lyrics")

  const config = window.__SNOWKIT_PLAYER__ || {}
  const lyrics = Array.isArray(config.lyrics) ? config.lyrics : []
  const streamUrl = typeof config.socketUrl === "string" ? config.socketUrl : ""
  const streamMimeType = typeof config.mimeType === "string" ? config.mimeType : "audio/mp4"
  const streamChunks = []

  let socket = null
  let streamEnded = false
  let activeLyricIndex = -1
  let lyricScrollFrame = 0
  let resolveStreamReady

  const streamReady = new Promise((resolve) => {
    resolveStreamReady = resolve
  })

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return "0:00"
    const minutes = Math.floor(seconds / 60)
    const remainder = Math.floor(seconds % 60)
    return minutes + ":" + String(remainder).padStart(2, "0")
  }

  const toWebSocketUrl = (url) => {
    if (/^wss?:/i.test(url)) return url
    if (/^https:/i.test(url)) return "wss:" + url.slice(6)
    if (/^http:/i.test(url)) return "ws:" + url.slice(5)
    return url
  }

  const markStreamReady = () => {
    if (!resolveStreamReady) return
    resolveStreamReady()
    resolveStreamReady = null
  }

  const finishStream = () => {
    if (streamEnded) return
    streamEnded = true

    if (streamChunks.length > 0) {
      const blob = new Blob(streamChunks, { type: streamMimeType })
      audio.src = URL.createObjectURL(blob)
    }

    markStreamReady()
  }

  const startSocketStream = () => {
    if (!streamUrl || typeof WebSocket === "undefined") return false

    try {
      socket = new WebSocket(toWebSocketUrl(streamUrl))
      socket.binaryType = "arraybuffer"
      socket.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) streamChunks.push(event.data)
        if (typeof event.data === "string" && event.data === "[end]") finishStream()
      }
      socket.onerror = finishStream
      socket.onclose = finishStream
      return true
    } catch {
      return false
    }
  }

  const showPlayingState = () => {
    playIcon.style.display = "none"
    pauseIcon.style.display = "block"
  }

  const showPausedState = () => {
    playIcon.style.display = "block"
    pauseIcon.style.display = "none"
  }

  const updateProgress = () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return
    const percent = Math.max(0, Math.min(100, (audio.currentTime / audio.duration) * 100))
    progressFill.style.width = percent + "%"
    progressThumb.style.left = percent + "%"
    currentTimeLabel.textContent = formatTime(audio.currentTime)
  }

  const seekTo = (seconds) => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return
    audio.currentTime = Math.max(0, Math.min(audio.duration, seconds))
    updateProgress()
    syncLyrics()
  }

  const scrollToLyric = (element) => {
    if (!element || !lyricsContainer) return
    if (lyricScrollFrame) cancelAnimationFrame(lyricScrollFrame)

    const start = lyricsContainer.scrollTop
    const max = Math.max(0, lyricsContainer.scrollHeight - lyricsContainer.clientHeight)
    const desired = element.offsetTop - (lyricsContainer.clientHeight - element.offsetHeight) * 0.46
    const target = Math.max(0, Math.min(max, desired))
    const distance = target - start
    const startedAt = performance.now()
    const duration = 520

    const animate = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 4)
      lyricsContainer.scrollTop = start + distance * eased

      if (progress < 1) lyricScrollFrame = requestAnimationFrame(animate)
      else lyricScrollFrame = 0
    }

    lyricScrollFrame = requestAnimationFrame(animate)
  }

  const lyricElements = []

  const syncLyrics = () => {
    if (!lyrics.length) return

    const positionMs = audio.currentTime * 1000
    let nextIndex = -1

    for (let index = 0; index < lyrics.length; index += 1) {
      if (positionMs >= lyrics[index].start_ms) nextIndex = index
      else break
    }

    if (nextIndex === activeLyricIndex) return
    activeLyricIndex = nextIndex

    lyricElements.forEach((element, index) => {
      element.className = "lyric-line"
      if (index === nextIndex) element.classList.add("is-active")
      else if (index < nextIndex) element.classList.add("is-past")
    })

    if (nextIndex >= 0) scrollToLyric(lyricElements[nextIndex])
  }

  const renderLyrics = () => {
    if (!lyrics.length) {
      const emptyState = document.createElement("div")
      emptyState.className = "player-empty-lyrics"
      emptyState.textContent = "Letra indisponível para esta faixa."
      lyricsContainer.appendChild(emptyState)
      return
    }

    lyrics.forEach((line, index) => {
      const element = document.createElement("div")
      element.className = "lyric-line"
      element.textContent = line.text || "♪"
      element.addEventListener("click", () => seekTo(line.start_ms / 1000))
      lyricsContainer.appendChild(element)
      lyricElements.push(element)
    })
  }

  renderLyrics()

  if (!startSocketStream()) {
    audio.src = streamUrl
    markStreamReady()
  }

  playButton.addEventListener("click", async () => {
    try {
      if (audio.paused) {
        await streamReady
        await audio.play()
      } else {
        audio.pause()
      }
    } catch {
      showPausedState()
    }
  })

  rewindButton.addEventListener("click", () => seekTo(audio.currentTime - 15))
  forwardButton.addEventListener("click", () => seekTo(audio.currentTime + 15))
  favoriteButton.addEventListener("click", () => favoriteButton.classList.toggle("is-active"))

  progressBar.addEventListener("pointerdown", (event) => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return
    const bounds = progressBar.getBoundingClientRect()
    const position = Math.max(0, Math.min(event.clientX - bounds.left, bounds.width))
    seekTo((position / bounds.width) * audio.duration)
  })

  audio.addEventListener("loadedmetadata", () => {
    durationLabel.textContent = formatTime(audio.duration)
  })
  audio.addEventListener("timeupdate", () => {
    updateProgress()
    syncLyrics()
  })
  audio.addEventListener("play", showPlayingState)
  audio.addEventListener("pause", () => {
    if (!audio.ended) showPausedState()
  })
  audio.addEventListener("ended", () => {
    showPausedState()
    progressFill.style.width = "0%"
    progressThumb.style.left = "0%"
    currentTimeLabel.textContent = "0:00"
    activeLyricIndex = -1
    syncLyrics()
  })

  window.addEventListener("beforeunload", () => socket?.close())
})()
