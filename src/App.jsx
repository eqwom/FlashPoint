import { useState, useEffect, useRef } from 'react'
import Peer from 'peerjs'

const CHUNK_SIZE = 65536

function formatBytes(b) {
  if (!b || b === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatSpeed(bps) {
  return formatBytes(Math.round(bps)) + '/s'
}

function IconBolt({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M13 2L4.5 13.5H11L9 22L19.5 10H13L13 2Z" fill="currentColor" />
    </svg>
  )
}

function IconFile() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function IconShield() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function IconArrowDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <polyline points="20,6 9,17 4,12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function IconWarn() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="1.5" />
      <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  )
}

function IconLink() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M15 7h3a5 5 0 015 5 5 5 0 01-5 5h-3m-6 0H6a5 5 0 01-5-5 5 5 0 015-5h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function App() {
  const [myId, setMyId] = useState('')
  const [remoteId, setRemoteId] = useState('')
  const [phase, setPhase] = useState('loading')
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [received, setReceived] = useState(null)
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const peerRef = useRef(null)
  const connRef = useRef(null)
  const chunksRef = useRef([])
  const metaRef = useRef(null)
  const bytesRef = useRef(0)
  const speedTimerRef = useRef(null)
  const elapsedTimerRef = useRef(null)
  const lastBytesRef = useRef(0)
  const startTimeRef = useRef(0)

  useEffect(() => {
    initPeer()
    return () => {
      peerRef.current?.destroy()
      clearInterval(speedTimerRef.current)
      clearInterval(elapsedTimerRef.current)
    }
  }, [])

  function initPeer() {
    const peer = new Peer(undefined, { debug: 0 })
    peerRef.current = peer

    peer.on('open', id => {
      setMyId(id)
      setPhase('ready')
      setMsg('Your peer node is live. Share your ID or connect to a sender.')
    })

    peer.on('connection', conn => {
      connRef.current = conn
      setPhase('waiting')
      setMsg('Incoming peer handshake...')
      conn.on('open', () => {
        setMsg('Peer connected. Awaiting file transfer...')
        listenForData(conn)
      })
      conn.on('error', err => handleError(err.message))
    })

    peer.on('error', err => handleError(err.type + ': ' + err.message))
    peer.on('disconnected', () => {
      if (phase !== 'done' && phase !== 'error') {
        setMsg('Disconnected from signaling server. Reconnecting...')
        peer.reconnect()
      }
    })
  }

  function listenForData(conn) {
    conn.on('data', data => {
      if (data.type === 'meta') {
        metaRef.current = data
        chunksRef.current = new Array(data.totalChunks)
        bytesRef.current = 0
        lastBytesRef.current = 0
        setPhase('receiving')
        setProgress(0)
        setMsg('Receiving ' + data.name)
        startTimers()
      } else if (data.type === 'chunk') {
        chunksRef.current[data.index] = data.data
        bytesRef.current += data.data.byteLength
        setProgress(Math.round((bytesRef.current / metaRef.current.size) * 100))
      } else if (data.type === 'done') {
        stopTimers()
        assembleFile()
      }
    })
    conn.on('close', () => {
      if (phase !== 'done') handleError('Connection closed unexpectedly.')
    })
  }

  function assembleFile() {
    const meta = metaRef.current
    const blob = new Blob(chunksRef.current.filter(Boolean), {
      type: meta.mimeType || 'application/octet-stream',
    })
    const url = URL.createObjectURL(blob)
    setReceived({ name: meta.name, url, size: meta.size })
    setPhase('done')
    setProgress(100)
    setSpeed(0)
    setMsg('Transfer complete — ' + meta.name)
  }

  function startTimers() {
    startTimeRef.current = Date.now()
    clearInterval(speedTimerRef.current)
    clearInterval(elapsedTimerRef.current)

    speedTimerRef.current = setInterval(() => {
      const cur = bytesRef.current
      setSpeed((cur - lastBytesRef.current) * 2)
      lastBytesRef.current = cur
    }, 500)

    elapsedTimerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
  }

  function stopTimers() {
    clearInterval(speedTimerRef.current)
    clearInterval(elapsedTimerRef.current)
    setSpeed(0)
  }

  function handleError(errMsg) {
    stopTimers()
    setPhase('error')
    setMsg(errMsg)
  }

  function handleConnect() {
    const id = remoteId.trim()
    if (!id || !peerRef.current) return
    if (id === myId) {
      setMsg('Cannot connect to yourself.')
      return
    }
    setPhase('connecting')
    setMsg('Establishing WebRTC connection...')

    const conn = peerRef.current.connect(id, { reliable: true })
    connRef.current = conn

    conn.on('open', () => {
      setPhase('connected')
      setMsg('Handshake complete. Ready to send a file.')
    })

    conn.on('error', err => handleError('Connection failed: ' + err.message))
    conn.on('close', () => {
      if (phase !== 'done') handleError('Peer disconnected.')
    })
  }

  async function handleSend() {
    const conn = connRef.current
    if (!file || !conn) return

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

    setPhase('sending')
    setProgress(0)
    setMsg('Sending ' + file.name)
    bytesRef.current = 0
    lastBytesRef.current = 0
    setElapsed(0)
    startTimers()

    conn.send({
      type: 'meta',
      name: file.name,
      size: file.size,
      mimeType: file.type,
      totalChunks,
    })

    const buf = await file.arrayBuffer()

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const chunk = buf.slice(start, start + CHUNK_SIZE)
      conn.send({ type: 'chunk', index: i, data: chunk })
      bytesRef.current += chunk.byteLength
      setProgress(Math.round(((i + 1) / totalChunks) * 100))
      if (i % 20 === 0) await new Promise(r => setTimeout(r, 0))
    }

    conn.send({ type: 'done' })
    stopTimers()
    setPhase('done')
    setProgress(100)
    setMsg('All chunks delivered — ' + file.name)
  }

  function copyId() {
    navigator.clipboard.writeText(myId).catch(() => {
      const el = document.createElement('textarea')
      el.value = myId
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function onFileChange(e) {
    if (e.target.files?.[0]) setFile(e.target.files[0])
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0])
  }

  function resetApp() {
    window.location.reload()
  }

  const isActive = phase === 'sending' || phase === 'receiving'
  const statusVariant =
    phase === 'done'
      ? 'success'
      : phase === 'error'
      ? 'danger'
      : phase === 'connected' || phase === 'waiting' || isActive
      ? 'active'
      : 'muted'

  return (
    <div className="root">
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-glow" aria-hidden="true" />

      <div className="shell">
        <header className="header">
          <div className="brand">
            <span className="brand-bolt">
              <IconBolt size={20} />
            </span>
            <span className="brand-name">FlashPoint</span>
          </div>
          <div className="header-tags">
            <span className="tag">
              <IconShield /> Zero Upload
            </span>
            <span className="tag">WebRTC</span>
          </div>
        </header>

        <div className="cards">
          {phase === 'loading' && (
            <div className="card card-center anim-fade">
              <div className="loader" />
              <p className="muted-text">Initializing WebRTC peer node...</p>
            </div>
          )}

          {phase !== 'loading' && (
            <>
              <div className="card card-id anim-fade">
                <div className="field-label">YOUR PEER ID</div>
                <div className="id-row">
                  <span className="id-value">{myId}</span>
                  <button className={`btn-copy${copied ? ' is-copied' : ''}`} onClick={copyId}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p className="hint-text">Share this ID with the person sending you a file</p>
              </div>

              {(phase === 'ready' || phase === 'connecting') && (
                <div className="card anim-fade" style={{ animationDelay: '0.05s' }}>
                  <div className="field-label">CONNECT TO PEER</div>
                  <div className="input-row">
                    <div className="input-wrap">
                      <IconLink />
                      <input
                        className="text-input"
                        placeholder="Paste peer ID..."
                        value={remoteId}
                        onChange={e => setRemoteId(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleConnect()}
                        disabled={phase === 'connecting'}
                        spellCheck={false}
                        autoComplete="off"
                      />
                    </div>
                    <button
                      className="btn-primary"
                      onClick={handleConnect}
                      disabled={phase === 'connecting' || !remoteId.trim()}
                    >
                      {phase === 'connecting' ? (
                        <><span className="btn-spinner" /> Connecting</>
                      ) : (
                        'Connect →'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {phase === 'connected' && (
                <div className="card anim-fade" style={{ animationDelay: '0.05s' }}>
                  <div className="field-label">SELECT FILE TO SEND</div>
                  <div
                    className={`drop-zone${dragOver ? ' is-dragging' : ''}${file ? ' has-file' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    onClick={() => document.getElementById('file-input').click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && document.getElementById('file-input').click()}
                  >
                    <input
                      id="file-input"
                      type="file"
                      className="sr-only"
                      onChange={onFileChange}
                      tabIndex={-1}
                    />
                    {file ? (
                      <div className="file-preview">
                        <div className="file-icon">
                          <IconFile />
                        </div>
                        <div className="file-details">
                          <span className="file-name">{file.name}</span>
                          <span className="file-meta">{formatBytes(file.size)}</span>
                        </div>
                        <button
                          className="btn-clear"
                          onClick={e => { e.stopPropagation(); setFile(null) }}
                          title="Clear file"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="drop-prompt">
                        <div className="drop-up-arrow">↑</div>
                        <span className="drop-main">Drop file here or click to browse</span>
                        <span className="drop-sub">Any type · Any size · Browser-to-browser only</span>
                      </div>
                    )}
                  </div>
                  <button
                    className="btn-send"
                    onClick={handleSend}
                    disabled={!file}
                  >
                    <IconBolt size={15} />
                    Transmit File
                  </button>
                </div>
              )}

              {phase === 'waiting' && (
                <div className="card card-center anim-fade" style={{ animationDelay: '0.05s' }}>
                  <div className="pulse-rig">
                    <div className="pulse-ring r1" />
                    <div className="pulse-ring r2" />
                    <div className="pulse-core" />
                  </div>
                  <p className="muted-text">Standing by for incoming transfer...</p>
                </div>
              )}

              {isActive && (
                <div className="card card-transfer anim-fade" style={{ animationDelay: '0.05s' }}>
                  <div className="transfer-top">
                    <div className="field-label">{phase === 'sending' ? 'TRANSMITTING' : 'RECEIVING'}</div>
                    <div className="transfer-stats">
                      <span className="stat-pct">{progress}%</span>
                      {speed > 512 && (
                        <span className="stat-speed">{formatSpeed(speed)}</span>
                      )}
                      {elapsed > 0 && (
                        <span className="stat-time">{elapsed}s</span>
                      )}
                    </div>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: progress + '%' }}
                      role="progressbar"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                  <div className="transfer-file">
                    {metaRef.current?.name || file?.name || ''}
                    {metaRef.current?.size && (
                      <span className="transfer-bytes">
                        {formatBytes(bytesRef.current)} / {formatBytes(metaRef.current.size)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {phase === 'done' && received && (
                <div className="card card-done anim-pop" style={{ animationDelay: '0.05s' }}>
                  <div className="done-check">
                    <IconCheck />
                  </div>
                  <div className="done-title">File Received</div>
                  <div className="done-file">
                    <span className="file-name">{received.name}</span>
                    <span className="file-meta">{formatBytes(received.size)}</span>
                  </div>
                  <a
                    className="btn-download"
                    href={received.url}
                    download={received.name}
                  >
                    <IconArrowDown />
                    Download {received.name}
                  </a>
                </div>
              )}

              {phase === 'done' && !received && (
                <div className="card card-done anim-pop" style={{ animationDelay: '0.05s' }}>
                  <div className="done-check">
                    <IconCheck />
                  </div>
                  <div className="done-title">Transmission Complete</div>
                  <p className="hint-text" style={{ textAlign: 'center' }}>
                    All {Math.ceil((file?.size || 0) / CHUNK_SIZE)} chunks delivered to peer.
                  </p>
                  <button className="btn-secondary" onClick={resetApp}>Send Another</button>
                </div>
              )}

              {phase === 'error' && (
                <div className="card card-error anim-fade">
                  <div className="error-glyph">
                    <IconWarn />
                  </div>
                  <div className="error-msg">{msg}</div>
                  <button className="btn-primary" onClick={resetApp}>Restart Session</button>
                </div>
              )}

              <div className={`status-bar status-${statusVariant} anim-fade`}>
                <span className="s-dot" />
                <span className="s-text">{msg}</span>
              </div>
            </>
          )}
        </div>

        <footer className="footer">
          <span>All data flows directly peer-to-peer via WebRTC DataChannel.</span>
          <span>Nothing is stored on or routed through any server.</span>
        </footer>
      </div>
    </div>
  )
}
