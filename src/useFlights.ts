import { useEffect, useState } from "react"

export type Flight = {
  hex: string
  flight: string
  lat: number
  lon: number
  alt_baro: number
  gs: number
  track: number
  orig_iata?: string
  dest_iata?: string
}

export function useFlights(lat: number, lon: number) {
  const [flights, setFlights] = useState<Flight[]>([])

  useEffect(() => {
    if (!lat || !lon) return
    const fetch_flights = async () => {
      const res = await fetch(
        `https://api.airplanes.live/v2/point/${lat}/${lon}/100`
      )
      const data = await res.json()
      setFlights(data.ac ?? [])
    }

    fetch_flights()
    const interval = setInterval(fetch_flights, 5000)
    return () => clearInterval(interval)
  }, [lat, lon])

  return flights
}
