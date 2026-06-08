import { useEffect, useRef, useState } from "react"
import { useFlights } from "./useFlights"

const CENTER_LAT = 28.5355
const CENTER_LON = 77.2410
const SCALE = 5
const UPDATE_INTERVAL = 5000

function latLonToXY(lat: number, lon: number, w: number, h: number) {
  const kmPerDegLat = 111
  const kmPerDegLon = 111 * Math.cos((CENTER_LAT * Math.PI) / 180)
  const x = w / 2 + (lon - CENTER_LON) * kmPerDegLon * SCALE
  const y = h / 2 - (lat - CENTER_LAT) * kmPerDegLat * SCALE
  return { x, y }
}

function altitudeColor(alt: number) {
  if (alt > 25000) return "#38bdf8"
  if (alt > 15000) return "#a3e635"
  if (alt > 5000) return "#f97316"
  return "#ef4444"
}

function drawPlane(ctx: CanvasRenderingContext2D, color: string) {
  ctx.shadowColor = color
  ctx.shadowBlur = 30
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, -12)
  ctx.lineTo(2, -4)
  ctx.lineTo(2, 6)
  ctx.lineTo(0, 8)
  ctx.lineTo(-2, 6)
  ctx.lineTo(-2, -4)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-2, 0)
  ctx.lineTo(-12, 6)
  ctx.lineTo(-10, 8)
  ctx.lineTo(0, 4)
  ctx.lineTo(10, 8)
  ctx.lineTo(12, 6)
  ctx.lineTo(2, 0)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-1, 6)
  ctx.lineTo(-5, 10)
  ctx.lineTo(-4, 11)
  ctx.lineTo(0, 8)
  ctx.lineTo(4, 11)
  ctx.lineTo(5, 10)
  ctx.lineTo(1, 6)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0
}

type Pos = { x: number; y: number }

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const flights = useFlights()
  const trailsRef = useRef<Map<string, Pos[]>>(new Map())
  const prevPosRef = useRef<Map<string, Pos>>(new Map())
  const curPosRef = useRef<Map<string, Pos>>(new Map())
  const lastUpdateRef = useRef<number>(Date.now())
  const rafRef = useRef<number>(0)
  const flightsRef = useRef(flights)
  const [selected, setSelected] = useState<{flight: any, x: number, y: number} | null>(null)

  useEffect(() => {
    flightsRef.current = flights
    const canvas = canvasRef.current
    if (!canvas) return

    flights.forEach((f) => {
      if (!f.lat || !f.lon) return
      const newPos = latLonToXY(f.lat, f.lon, canvas.width, canvas.height)
      const old = curPosRef.current.get(f.hex)
      prevPosRef.current.set(f.hex, old ?? newPos)
      curPosRef.current.set(f.hex, newPos)
    })

    lastUpdateRef.current = Date.now()
  }, [flights])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const draw = () => {
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const t = Math.min((Date.now() - lastUpdateRef.current) / UPDATE_INTERVAL, 1)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const cx = canvas.width / 2
      const cy = canvas.height / 2
      ctx.strokeStyle = "rgba(255,255,255,0.08)"
      ctx.lineWidth = 1
      ;[100, 200, 300].forEach(r => {
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
      })
      ctx.fillStyle = "rgba(255,255,255,0.2)"
      ctx.font = "12px monospace"
      ctx.fillText("N", cx - 5, cy - 310)
      ctx.fillText("S", cx - 5, cy + 320)
      ctx.fillText("E", cx + 312, cy + 4)
      ctx.fillText("W", cx - 320, cy + 4)

      flightsRef.current.forEach((f) => {
        if (!f.lat || !f.lon) return

        const prev = prevPosRef.current.get(f.hex)
        const cur = curPosRef.current.get(f.hex)
        if (!prev || !cur) return

        const x = prev.x + (cur.x - prev.x) * t
        const y = prev.y + (cur.y - prev.y) * t
        const color = altitudeColor(f.alt_baro || 0)

        const trail = trailsRef.current.get(f.hex) ?? []
        if (trail.length === 0 || Math.hypot(x - trail[trail.length-1].x, y - trail[trail.length-1].y) > 1) {
          trail.push({ x, y })
          if (trail.length > 40) trail.shift()
          trailsRef.current.set(f.hex, trail)
        }

        trail.forEach((pos, i) => {
          const alpha = i / trail.length
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2)
          ctx.fillStyle = "rgba(249,115,22," + (alpha * 0.5) + ")"
          ctx.fill()
        })

        const angle = ((f.track || 0) * Math.PI) / 180
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(angle)
        drawPlane(ctx, color)
        ctx.restore()

        const label = f.flight?.trim() || f.hex
        const speed = f.gs ? Math.round(f.gs) + " kt" : ""
        const route = f.orig_iata && f.dest_iata ? f.orig_iata + " → " + f.dest_iata : ""

        ctx.fillStyle = "white"
        ctx.font = "11px monospace"
        ctx.fillText(label, x + 14, y - 8)
        ctx.fillStyle = color
        ctx.font = "10px monospace"
        ctx.fillText((f.alt_baro || 0) + " ft  " + speed, x + 14, y + 4)
        if (route) {
          ctx.fillStyle = "#888"
          ctx.fillText(route, x + 14, y + 16)
        }
      })

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ display: "block", background: "black" }}
        onClick={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect()
          if (!rect) return
          const mx = e.clientX - rect.left
          const my = e.clientY - rect.top
          const hit = flightsRef.current.find(f => {
            if (!f.lat || !f.lon) return false
            const {x, y} = latLonToXY(f.lat, f.lon, window.innerWidth, window.innerHeight)
            return Math.hypot(mx - x, my - y) < 20
          })
          setSelected(hit ? {flight: hit, x: e.clientX, y: e.clientY} : null)
        }}
      />
      {selected && (
        <div style={{
          position: "fixed",
          left: selected.x + 16,
          top: selected.y - 60,
          background: "rgba(0,0,0,0.85)",
          border: "1px solid #f97316",
          borderRadius: 8,
          padding: "10px 14px",
          color: "white",
          fontFamily: "monospace",
          fontSize: 12,
          zIndex: 10,
          minWidth: 180
        }}>
          <div style={{color: "#f97316", fontSize: 14, marginBottom: 4}}>
            {selected.flight.flight?.trim() || selected.flight.hex}
          </div>
          <div>{selected.flight.orig_iata} → {selected.flight.dest_iata}</div>
          <div>Alt: {selected.flight.alt_baro} ft</div>
          <div>Speed: {Math.round(selected.flight.gs)} kt</div>
          <div style={{color: "#888", marginTop: 4}}>{selected.flight.desc || "unknown type"}</div>
        </div>
      )}
    </>
  )
}

export default App
