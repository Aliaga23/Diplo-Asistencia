"use client"

import { MoonStarsIcon, SunIcon } from "@phosphor-icons/react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cambiar tema"
          onClick={() => setTheme(dark ? "light" : "dark")}
        >
          <SunIcon className="hidden size-[18px] dark:block" />
          <MoonStarsIcon className="size-[18px] dark:hidden" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{dark ? "Tema claro" : "Tema oscuro"}</TooltipContent>
    </Tooltip>
  )
}
