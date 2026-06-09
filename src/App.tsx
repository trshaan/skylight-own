import { useEffect, useRef, useState } from "react"
import { useFlights } from "./useFlights"

let SCALE = 5
let mirrorX = false
const UPDATE_INTERVAL = 5000

function latLonToXY(lat: number, lon: number, clat: number, clon: number, w: number, h: number) {
  const raw = w / 2 + (lon - clon) * 111 * Math.cos(clat * Math.PI / 180) * SCALE
  const x = mirrorX ? w - raw : raw
  const y = h / 2 - (lat - clat) * 111 * SCALE
  return { x, y }
}

function altColor(alt: number) {
  if (alt > 25000) return "#38bdf8"
  if (alt > 15000) return "#a3e635"
  if (alt > 5000) return "#f97316"
  return "#ef4444"
}

function drawPlane(ctx: CanvasRenderingContext2D, color: string) {
  ctx.shadowColor = color; ctx.shadowBlur = 30; ctx.fillStyle = color
  ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(2,-4); ctx.lineTo(2,6); ctx.lineTo(0,8); ctx.lineTo(-2,6); ctx.lineTo(-2,-4); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(-2,0); ctx.lineTo(-12,6); ctx.lineTo(-10,8); ctx.lineTo(0,4); ctx.lineTo(10,8); ctx.lineTo(12,6); ctx.lineTo(2,0); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(-1,6); ctx.lineTo(-5,10); ctx.lineTo(-4,11); ctx.lineTo(0,8); ctx.lineTo(4,11); ctx.lineTo(5,10); ctx.lineTo(1,6); ctx.closePath(); ctx.fill()
  ctx.shadowBlur = 0
}

type Pos = { x: number; y: number }

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [center, setCenter] = useState<{lat:number,lon:number}>({lat:28.5355,lon:77.2410})
  const flights = useFlights(center.lat, center.lon)
  const flightsRef = useRef(flights)
  const centerRef = useRef(center)
  const trails = useRef<Map<string,Pos[]>>(new Map())
  const prev = useRef<Map<string,Pos>>(new Map())
  const cur = useRef<Map<string,Pos>>(new Map())
  const lastUpdate = useRef(Date.now())
  const raf = useRef(0)
  const [selected, setSelected] = useState<{f:any,x:number,y:number}|null>(null)
  const isDragging = useRef(false)
  const dragStart = useRef<{x:number,y:number}>({x:0,y:0})
  const dragCenter = useRef(center)
  const [nightMode, setNightMode] = useState(false)
  const nightModeRef = useRef(false)
  const [mirror, setMirror] = useState(false)

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      p => setCenter({lat: p.coords.latitude, lon: p.coords.longitude}),
      () => {}
    )
  }, [])

  useEffect(() => {
    flightsRef.current = flights
    centerRef.current = center
    const canvas = canvasRef.current
    if (!canvas) return
    const W = window.innerWidth, H = window.innerHeight
    flights.forEach(f => {
      if (!f.lat||!f.lon) return
      const np = latLonToXY(f.lat, f.lon, center.lat, center.lon, W, H)
      prev.current.set(f.hex, cur.current.get(f.hex) ?? np)
      cur.current.set(f.hex, np)
    })
    lastUpdate.current = Date.now()
  }, [flights, center])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    function draw() {
      const ctx = canvas!.getContext("2d")!
      const c = centerRef.current
      const W = canvas!.width, H = canvas!.height
      const t = Math.min((Date.now() - lastUpdate.current) / UPDATE_INTERVAL, 1)
      ctx.clearRect(0,0,W,H)
      if (nightModeRef.current) {
        ctx.fillStyle = "#140a00"
        ctx.fillRect(0,0,W,H)
      }
      const cx = W/2, cy = H/2
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1
      ;[100,200,300].forEach(r => { ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke() })
      ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.font = "12px monospace"
      ctx.fillText("N", cx-5, cy-310); ctx.fillText("S", cx-5, cy+320)
      ctx.fillText("E", cx+312, cy+4); ctx.fillText("W", cx-320, cy+4)

      const pulse = (Math.sin(Date.now() / 500) + 1) / 2
      ctx.beginPath(); ctx.arc(cx, cy, 6 + pulse * 4, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(56,189,248,${0.1 + pulse * 0.2})`; ctx.fill()
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2)
      ctx.fillStyle = "#38bdf8"; ctx.fill()

      const rwys = [
        [28.5665, 77.0890, 28.5562, 77.1180],
        [28.5530, 77.0850, 28.5440, 77.1100],
      ]
      ctx.strokeStyle = "rgba(100,200,255,0.3)"; ctx.lineWidth = 4
      rwys.forEach(([lat1,lon1,lat2,lon2]) => {
        const a = latLonToXY(lat1,lon1,c.lat,c.lon,W,H)
        const b = latLonToXY(lat2,lon2,c.lat,c.lon,W,H)
        ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke()
      })
      ctx.lineWidth = 1

      flightsRef.current.forEach(f => {
        if (!f.lat||!f.lon) return
        const p = prev.current.get(f.hex); const cu = cur.current.get(f.hex)
        if (!p||!cu) return
        const x = p.x+(cu.x-p.x)*t; const y = p.y+(cu.y-p.y)*t
        const color = altColor(f.alt_baro||0)
        const trail = trails.current.get(f.hex)??[]
        if (!trail.length||Math.hypot(x-trail[trail.length-1].x,y-trail[trail.length-1].y)>1) {
          trail.push({x,y}); if(trail.length>40) trail.shift(); trails.current.set(f.hex,trail)
        }
        trail.forEach((pos,i) => {
          ctx.beginPath(); ctx.arc(pos.x,pos.y,1.5,0,Math.PI*2)
          ctx.fillStyle=`rgba(249,115,22,${(i/trail.length)*0.5})`; ctx.fill()
        })
        ctx.save(); ctx.translate(x,y); ctx.rotate(((f.track||0)*Math.PI)/180)
        const isLanding = (f.alt_baro || 0) < 3000
        const flashColor = isLanding && Math.floor(Date.now() / 500) % 2 === 0 ? "#ef4444" : color
        drawPlane(ctx, flashColor); ctx.restore()
        ctx.fillStyle="white"; ctx.font="11px monospace"
        ctx.fillText(f.flight?.trim()||f.hex, x+14, y-8)
        ctx.fillStyle=color; ctx.font="10px monospace"
        ctx.fillText(`${f.alt_baro||0} ft  ${f.gs?Math.round(f.gs)+" kt":""}`, x+14, y+4)
        if (f.orig_iata&&f.dest_iata) { ctx.fillStyle="#888"; ctx.fillText(`${f.orig_iata} → ${f.dest_iata}`, x+14, y+16) }
      })
      raf.current = requestAnimationFrame(draw)
    }
    raf.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf.current)
  }, [])

  const airlineCounts = Object.entries(
    flights.reduce((acc, f) => {
      const code = f.flight?.trim().slice(0,3) || "???"
      acc[code] = (acc[code]||0) + 1
      return acc
    }, {} as Record<string,number>)
  ).sort((a,b) => b[1]-a[1]).slice(0,6)

  return (
    <>
      <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight}
        style={{display:"block", background: nightMode ? "#140a00" : "black"}}
        onWheel={e => { SCALE = Math.max(1, Math.min(20, SCALE - e.deltaY * 0.01)) }}
        onMouseDown={e => {
          isDragging.current = true
          dragStart.current = {x: e.clientX, y: e.clientY}
          dragCenter.current = centerRef.current
        }}
        onMouseMove={e => {
          if (!isDragging.current) return
          const dx = e.clientX - dragStart.current.x
          const dy = e.clientY - dragStart.current.y
          const newLat = dragCenter.current.lat + dy / (111 * SCALE)
          const newLon = dragCenter.current.lon - dx / (111 * Math.cos(dragCenter.current.lat * Math.PI / 180) * SCALE)
          setCenter({lat: newLat, lon: newLon})
        }}
        onMouseUp={() => { isDragging.current = false }}
        onClick={e => {
          const c = centerRef.current
          const r = canvasRef.current!.getBoundingClientRect()
          const mx = e.clientX-r.left, my = e.clientY-r.top
          const hit = flightsRef.current.find(f => {
            if (!f.lat||!f.lon) return false
            const {x,y} = latLonToXY(f.lat,f.lon,c.lat,c.lon,window.innerWidth,window.innerHeight)
            return Math.hypot(mx-x,my-y)<20
          })
          setSelected(hit?{f:hit,x:e.clientX,y:e.clientY}:null)
        }}
      />
      <div style={{position:"fixed",top:16,right:16,color:"rgba(255,255,255,0.4)",fontFamily:"monospace",fontSize:11}}>{flights.length} aircraft</div>
      <div onClick={() => { nightModeRef.current = !nightModeRef.current; setNightMode(n => !n) }}
        style={{position:"fixed",bottom:48,right:16,color: nightMode ? "#fbbf24" : "rgba(255,255,255,0.3)",fontFamily:"monospace",fontSize:11,cursor:"pointer"}}>
        ◑ {nightMode ? "day" : "night"}
      </div>
      <div onClick={() => { mirrorX = !mirrorX; setMirror(m => !m) }}
        style={{position:"fixed",bottom:80,right:16,color: mirror ? "#38bdf8" : "rgba(255,255,255,0.3)",fontFamily:"monospace",fontSize:11,cursor:"pointer"}}>
        ⇔ {mirror ? "mirrored" : "mirror"}
      </div>
      <div onClick={()=>document.documentElement.requestFullscreen()}
        style={{position:"fixed",bottom:16,right:16,color:"rgba(255,255,255,0.3)",fontFamily:"monospace",fontSize:11,cursor:"pointer"}}>
        ⛶ fullscreen
      </div>
      <div style={{position:"fixed",bottom:16,left:16,fontFamily:"monospace",fontSize:11,lineHeight:"1.8"}}>
        {airlineCounts.map(([code,count]) => (
          <div key={code} style={{color:"rgba(255,255,255,0.4)"}}>{code} — {count}</div>
        ))}
      </div>
      {selected && (
        <div style={{position:"fixed",left:selected.x+16,top:selected.y-60,background:"rgba(0,0,0,0.85)",border:"1px solid #f97316",borderRadius:8,padding:"10px 14px",color:"white",fontFamily:"monospace",fontSize:12,zIndex:10,minWidth:180}}>
          <div style={{color:"#f97316",fontSize:14,marginBottom:4}}>{selected.f.flight?.trim()||selected.f.hex}</div>
          <div>{selected.f.orig_iata} → {selected.f.dest_iata}</div>
          <div>Alt: {selected.f.alt_baro} ft</div>
          <div>Speed: {Math.round(selected.f.gs)} kt</div>
          <div style={{color:"#888",marginTop:4}}>{selected.f.desc||"unknown type"}</div>
        </div>
      )}
    </>
  )
}
