"use client"

import type React from "react"

interface BorderBeamProps {
  size?: number
  duration?: number
  delay?: number
  colorFrom?: string
  colorTo?: string
  className?: string
  style?: React.CSSProperties
  reverse?: boolean
  initialOffset?: number
  borderWidth?: number
}

export const BorderBeam = ({
  className = "",
  size = 50,
  delay = 0,
  duration = 6,
  colorFrom = "#ffffff",
  colorTo = "#94a3b8",
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 1.5
}: BorderBeamProps) => {
  return (
    <span
      aria-hidden="true"
      className="plasmo-pointer-events-none plasmo-absolute plasmo-inset-0 plasmo-rounded-[inherit] plasmo-border plasmo-border-transparent"
      style={{
        borderWidth,
        WebkitMask:
          "linear-gradient(transparent,transparent) padding-box, linear-gradient(#000,#000) border-box",
        WebkitMaskComposite: "xor",
        mask:
          "linear-gradient(transparent,transparent) padding-box, linear-gradient(#000,#000) border-box",
        maskComposite: "exclude"
      }}>
      <style>{`
        @keyframes plasmoBorderBeamTravel {
          from { offset-distance: ${initialOffset}%; }
          to { offset-distance: ${100 + initialOffset}%; }
        }
      `}</style>
      <span
        className={`plasmo-absolute ${className}`.trim()}
        style={{
          width: size,
          height: borderWidth,
          borderRadius: 9999,
          offsetPath: `rect(0 auto auto 0 round ${size}px)`,
          background: `linear-gradient(to left, transparent, ${colorFrom}, ${colorTo}, transparent)`,
          boxShadow: `0 0 ${Math.max(4, borderWidth * 4)}px ${colorTo}`,
          animation: `plasmoBorderBeamTravel ${duration}s linear ${-delay}s infinite`,
          animationDirection: reverse ? "reverse" : "normal",
          ...style
        }}
      />
    </span>
  )
}

