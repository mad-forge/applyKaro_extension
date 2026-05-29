import React from "react"

import { BackgroundBeamsWithCollision } from "@/components/ui/background-beams-with-collision"

export default function BackgroundBeamsWithCollisionDemo() {
  return (
    <BackgroundBeamsWithCollision>
      <h2 className="plasmo-relative plasmo-z-20 plasmo-text-center plasmo-font-sans plasmo-text-2xl plasmo-font-bold plasmo-tracking-normal plasmo-text-white md:plasmo-text-4xl lg:plasmo-text-7xl">
        What&apos;s cooler than Beams?{" "}
        <div className="plasmo-relative plasmo-mx-auto plasmo-inline-block plasmo-w-max">
          <div className="plasmo-absolute plasmo-left-0 plasmo-top-px plasmo-bg-gradient-to-r plasmo-from-purple-500 plasmo-via-violet-500 plasmo-to-pink-500 plasmo-bg-clip-text plasmo-bg-no-repeat plasmo-py-4 plasmo-text-transparent">
            <span>Exploding beams.</span>
          </div>
          <div className="plasmo-relative plasmo-bg-gradient-to-r plasmo-from-purple-500 plasmo-via-violet-500 plasmo-to-pink-500 plasmo-bg-clip-text plasmo-bg-no-repeat plasmo-py-4 plasmo-text-transparent">
            <span>Exploding beams.</span>
          </div>
        </div>
      </h2>
    </BackgroundBeamsWithCollision>
  )
}

