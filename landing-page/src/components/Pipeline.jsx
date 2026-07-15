"use client";

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    title: "1. Job Description Extraction",
    desc: "A self-contained script is injected into the active tab to safely scrape the JD from LinkedIn or Indeed layouts.",
    color: "#3b82f6" // blue
  },
  {
    title: "2. Deep JD Analysis",
    desc: "The LLM extracts role title, seniority, responsibilities, and every skill with a priority (critical / important / nice-to-have).",
    color: "#8b5cf6" // purple
  },
  {
    title: "3. ATS Scoring",
    desc: "Your resume text is matched deterministically against the analysis with alias/fuzzy matching to give an honest ATS score.",
    color: "#ec4899" // pink
  },
  {
    title: "4. Fact-Locked Tailoring",
    desc: "AI receives locked facts plus prioritized targets to optimize summary, skill order, and bullet wording. No hallucinations.",
    color: "#22c55e" // green
  }
];

export default function Pipeline() {
  const containerRef = useRef(null);
  const lineRef = useRef(null);
  const stepsRef = useRef([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Animate the central connecting line
      gsap.fromTo(lineRef.current,
        { scaleY: 0, transformOrigin: "top" },
        {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top center",
            end: "bottom center",
            scrub: 1
          }
        }
      );

      // Animate each step entering
      stepsRef.current.forEach((step, i) => {
        gsap.fromTo(step,
          { x: i % 2 === 0 ? -50 : 50, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: step,
              start: "top 80%",
            }
          }
        );
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="section" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="container" ref={containerRef}>
        
        <div style={{ textAlign: 'center', marginBottom: '6rem' }}>
          <h2>How it Works</h2>
          <p className="text-lg" style={{ maxWidth: '600px', margin: '0 auto' }}>
            A rigorous pipeline from extraction to PDF generation.
          </p>
        </div>

        <div style={{ position: 'relative', maxWidth: '800px', margin: '0 auto' }}>
          {/* Central Line */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: '4px',
            background: 'var(--bg-tertiary)',
            transform: 'translateX(-50%)',
            borderRadius: '2px'
          }}>
            <div ref={lineRef} style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(to bottom, #3b82f6, #8b5cf6, #ec4899, #22c55e)',
              borderRadius: '2px'
            }} />
          </div>

          {/* Steps */}
          {steps.map((step, idx) => {
            const isLeft = idx % 2 === 0;
            return (
              <div 
                key={idx} 
                ref={el => stepsRef.current[idx] = el}
                style={{
                  display: 'flex',
                  justifyContent: isLeft ? 'flex-start' : 'flex-end',
                  marginBottom: idx === steps.length - 1 ? 0 : '6rem',
                  position: 'relative',
                  width: '100%'
                }}
              >
                {/* Connector Dot */}
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--bg-primary)',
                  border: `4px solid ${step.color}`,
                  zIndex: 2,
                  boxShadow: `0 0 15px ${step.color}66`
                }} />

                {/* Card */}
                <div 
                  className="glass"
                  style={{
                    width: 'calc(50% - 40px)',
                    padding: '2rem',
                    borderRadius: '16px',
                    textAlign: isLeft ? 'right' : 'left',
                    position: 'relative'
                  }}
                >
                  <h3 style={{ color: step.color, marginBottom: '0.5rem', fontSize: '1.25rem' }}>{step.title}</h3>
                  <p style={{ margin: 0, fontSize: '0.95rem' }}>{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
