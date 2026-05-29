"use client"

import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import React, { useEffect, useRef, useState } from "react"

export const BackgroundBeamsWithCollision = ({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const parentRef = useRef<HTMLDivElement>(null)

  const beams = [
    { initialX: 10, translateX: 10, duration: 7, repeatDelay: 3, delay: 2 },
    { initialX: 100, translateX: 100, duration: 7, repeatDelay: 7, className: "plasmo-h-6" },
    { initialX: 180, translateX: 180, duration: 4, repeatDelay: 4, delay: 1 },
    { initialX: 260, translateX: 260, duration: 6, repeatDelay: 5, delay: 2, className: "plasmo-h-10" },
    { initialX: 340, translateX: 340, duration: 5, repeatDelay: 8, delay: 3, className: "plasmo-h-16" }
  ]

  return (
    <div
      ref={parentRef}
      className={cn(
        "plasmo-absolute plasmo-inset-0 plasmo-overflow-hidden plasmo-bg-black",
        className
      )}>
      {beams.map((beam, index) => (
        <CollisionMechanism
          key={`${beam.initialX}-${index}`}
          beamOptions={beam}
          containerRef={containerRef}
          parentRef={parentRef}
        />
      ))}

      {children}
      <div
        ref={containerRef}
        className="plasmo-pointer-events-none plasmo-absolute plasmo-inset-x-0 plasmo-bottom-0 plasmo-h-px plasmo-w-full plasmo-bg-neutral-900"
        style={{
          boxShadow:
            "0 0 20px rgba(255,255,255,0.08), 0 0 44px rgba(255,255,255,0.05)"
        }}
      />
    </div>
  )
}

const CollisionMechanism = React.forwardRef<
  HTMLDivElement,
  {
    containerRef: React.RefObject<HTMLDivElement>
    parentRef: React.RefObject<HTMLDivElement>
    beamOptions?: {
      initialX?: number
      translateX?: number
      initialY?: number | string
      translateY?: number | string
      rotate?: number
      className?: string
      duration?: number
      delay?: number
      repeatDelay?: number
    }
  }
>(({ parentRef, containerRef, beamOptions = {} }, ref) => {
  const beamRef = useRef<HTMLDivElement>(null)
  const [collision, setCollision] = useState<{
    detected: boolean
    coordinates: { x: number; y: number } | null
  }>({ detected: false, coordinates: null })
  const [beamKey, setBeamKey] = useState(0)
  const [cycleCollisionDetected, setCycleCollisionDetected] = useState(false)

  useEffect(() => {
    const checkCollision = () => {
      if (!beamRef.current || !containerRef.current || !parentRef.current || cycleCollisionDetected) return

      const beamRect = beamRef.current.getBoundingClientRect()
      const containerRect = containerRef.current.getBoundingClientRect()
      const parentRect = parentRef.current.getBoundingClientRect()

      if (beamRect.bottom >= containerRect.top) {
        setCollision({
          detected: true,
          coordinates: {
            x: beamRect.left - parentRect.left + beamRect.width / 2,
            y: beamRect.bottom - parentRect.top
          }
        })
        setCycleCollisionDetected(true)
      }
    }

    const animationInterval = window.setInterval(checkCollision, 80)
    return () => window.clearInterval(animationInterval)
  }, [cycleCollisionDetected, containerRef, parentRef])

  useEffect(() => {
    if (!collision.detected || !collision.coordinates) return

    const resetTimer = window.setTimeout(() => {
      setCollision({ detected: false, coordinates: null })
      setCycleCollisionDetected(false)
    }, 1700)
    const beamTimer = window.setTimeout(() => setBeamKey((prevKey) => prevKey + 1), 1700)

    return () => {
      window.clearTimeout(resetTimer)
      window.clearTimeout(beamTimer)
    }
  }, [collision])

  return (
    <>
      <motion.div
        key={beamKey}
        ref={(node) => {
          beamRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) ref.current = node
        }}
        animate="animate"
        initial={{
          translateY: beamOptions.initialY || "-200px",
          translateX: beamOptions.initialX || "0px",
          rotate: beamOptions.rotate || 0
        }}
        variants={{
          animate: {
            translateY: beamOptions.translateY || "760px",
            translateX: beamOptions.translateX || "0px",
            rotate: beamOptions.rotate || 0
          }
        }}
        transition={{
          duration: beamOptions.duration || 8,
          repeat: Infinity,
          repeatType: "loop",
          ease: "linear",
          delay: beamOptions.delay || 0,
          repeatDelay: beamOptions.repeatDelay || 0
        }}
        className={cn(
          "plasmo-absolute plasmo-left-0 plasmo-top-12 plasmo-m-auto plasmo-h-14 plasmo-w-px plasmo-rounded-full plasmo-bg-gradient-to-t plasmo-from-white plasmo-via-neutral-300 plasmo-to-transparent plasmo-opacity-70",
          beamOptions.className
        )}
      />
      <AnimatePresence>
        {collision.detected && collision.coordinates && (
          <Explosion
            key={`${collision.coordinates.x}-${collision.coordinates.y}`}
            style={{
              left: `${collision.coordinates.x}px`,
              top: `${collision.coordinates.y}px`,
              transform: "translate(-50%, -50%)"
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
})

CollisionMechanism.displayName = "CollisionMechanism"

const Explosion = ({ ...props }: React.HTMLProps<HTMLDivElement>) => {
  const spans = Array.from({ length: 16 }, (_, index) => ({
    id: index,
    directionX: Math.floor(Math.random() * 70 - 35),
    directionY: Math.floor(Math.random() * -44 - 10)
  }))

  return (
    <div {...props} className={cn("plasmo-absolute plasmo-z-0 plasmo-h-2 plasmo-w-2", props.className)}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="plasmo-absolute plasmo--inset-x-10 plasmo-top-0 plasmo-m-auto plasmo-h-2 plasmo-w-10 plasmo-rounded-full plasmo-bg-gradient-to-r plasmo-from-transparent plasmo-via-white plasmo-to-transparent plasmo-blur-sm"
      />
      {spans.map((span) => (
        <motion.span
          key={span.id}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: span.directionX, y: span.directionY, opacity: 0 }}
          transition={{ duration: Math.random() * 1.2 + 0.4, ease: "easeOut" }}
          className="plasmo-absolute plasmo-h-1 plasmo-w-1 plasmo-rounded-full plasmo-bg-white"
        />
      ))}
    </div>
  )
}

