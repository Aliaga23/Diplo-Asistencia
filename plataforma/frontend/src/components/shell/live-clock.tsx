"use client"

import { GlobeHemisphereWestIcon } from "@phosphor-icons/react"
import { useSyncExternalStore } from "react"

const fmt = new Intl.DateTimeFormat("es-BO", {
  timeZone: "America/La_Paz",
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 15_000)
  return () => clearInterval(id)
}

/** Minuto actual; cambia como mucho una vez por minuto para no re-renderizar de más. */
const currentMinute = () => Math.floor(Date.now() / 60_000)

/** Reloj en la zona horaria oficial del sistema (America/La_Paz). */
export function LiveClock() {
  const minute = useSyncExternalStore(subscribe, currentMinute, () => 0)
  return (
    <div className="mr-2 hidden items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs text-muted-foreground sm:flex">
      <GlobeHemisphereWestIcon className="size-3.5 text-primary" />
      <span className="tabular font-medium text-foreground">
        {minute ? fmt.format(new Date(minute * 60_000)) : "—"}
      </span>
      <span className="hidden lg:inline">· La Paz</span>
    </div>
  )
}
