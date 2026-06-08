import { useEffect, useRef } from "react"
import { useFlights } from "./useFlights"

const CENTER_LAT = 28.5355
const CENTER_LON = 77.2410
const SCALE = 3.5 // pixels per km

function latLonToXY(lat: number, lon: number, w: number, h: number) {
  const kmPerDegLat = 111
  const kmPerDegLon = 111 * Math.cos((CENTER_LAT * Math.PI) / 180)
  const x = w / 2 + (lon - CENTER_LON) * kmPerDegLon * SCALE
  const y = h / 2 - (lat - CENTER_LAT) * kmPerDegLat * SCALE
  return { x, y }
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const flights = useFlights()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    flights.forEach((f) => {
      if (!f.lat || !f.lon) return
      const { x, y } = latLonToXY(f.lat, f.lon, canvas.width, canvas.height)

      // draw plane dot
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fillStyle = "#f97316"
      ctx.fill()

      // draw label
      ctx.fillStyle = "white"
      ctx.font = "11px monospace"
      ctx.fillText(f.flight?.trim() || f.hex, x + 8, y - 8)
      ctx.fillStyle = "#888"
      ctx.fillText(`${f.alt_baro} ft`, x + 8, y + 4)
    })
  }, [flights])

  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth}
      height={window.innerHeight}
    />
  )
}

export default App