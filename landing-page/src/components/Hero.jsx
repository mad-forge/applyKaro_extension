"use client";

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { motion } from 'framer-motion';

export default function Hero() {
  const heroRef = useRef(null);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);
  const buttonsRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      
      tl.fromTo(titleRef.current, 
        { y: 50, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
      )
      .fromTo(subtitleRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
        "-=0.6"
      )
      .fromTo(buttonsRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" },
        "-=0.5"
      );
    }, heroRef);
    
    return () => ctx.revert();
  }, []);

  return (
    <section ref={heroRef} className="section flex-center" style={{ minHeight: '100vh', padding: '0 2rem' }}>
      <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 10 }}>
        
        {/* Glow effect behind text */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '60vw',
          height: '60vw',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(0,0,0,0) 70%)',
          zIndex: -1,
          pointerEvents: 'none',
        }} />

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1 }}
          style={{ 
            display: 'inline-block',
            padding: '0.5rem 1rem', 
            borderRadius: '99px',
            border: '1px solid var(--border-color)',
            background: 'var(--glass-bg)',
            marginBottom: '2rem',
            color: 'var(--accent-primary)',
            fontWeight: 600,
            fontSize: '0.875rem',
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}
        >
          Chrome Extension 🚀
        </motion.div>

        <h1 ref={titleRef} style={{ maxWidth: '900px', margin: '0 auto 1.5rem', opacity: 0 }}>
          The <span className="gradient-text">AI Resume Tailor</span> that respects your facts.
        </h1>
        
        <p ref={subtitleRef} className="text-xl" style={{ maxWidth: '700px', margin: '0 auto 3rem', opacity: 0 }}>
          Score your resume against any job description like an ATS. Generates a tailored PDF instantly—without hallucinating your experience. 
        </p>

        <div ref={buttonsRef} style={{ display: 'flex', gap: '1rem', justifyContent: 'center', opacity: 0 }}>
          <button className="btn btn-primary" style={{ fontSize: '1.125rem' }}>
            Add to Chrome — It's Free
          </button>
          <button className="btn btn-secondary" style={{ fontSize: '1.125rem' }}>
            View Demo
          </button>
        </div>

        {/* Floating extension mockup */}
        <motion.div 
          className="glass animate-float"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8, duration: 1, type: "spring", stiffness: 50 }}
          style={{ 
            marginTop: '5rem',
            maxWidth: '900px',
            height: '450px',
            margin: '5rem auto 0',
            borderRadius: '16px',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}
        >
           {/* Mockup Top Bar */}
           <div style={{ height: '40px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', padding: '0 1rem', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }} />
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#eab308' }} />
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }} />
              </div>
              <div style={{ margin: '0 auto', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                ApplyKro Side Panel
              </div>
           </div>
           
           {/* Mockup Content */}
           <div style={{ padding: '2rem', display: 'flex', height: 'calc(100% - 40px)', gap: '2rem' }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ height: '24px', width: '40%', background: 'var(--border-color)', borderRadius: '4px' }} />
                <div style={{ height: '12px', width: '100%', background: 'var(--border-color)', borderRadius: '4px' }} />
                <div style={{ height: '12px', width: '80%', background: 'var(--border-color)', borderRadius: '4px' }} />
                <div style={{ marginTop: 'auto', height: '40px', background: 'var(--accent-primary)', borderRadius: '8px', opacity: 0.8 }} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                   <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '4px solid var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
                      92%
                   </div>
                   <div>
                      <h4 style={{ margin: 0 }}>ATS Match</h4>
                      <span style={{ color: '#22c55e', fontSize: '0.875rem' }}>Highly compatible</span>
                   </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '1rem', flex: 1 }}>
                  <div style={{ height: '12px', width: '60%', background: 'var(--border-color)', borderRadius: '4px', marginBottom: '1rem' }} />
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['React', 'Next.js', 'TypeScript', 'Node.js', 'GraphQL'].map(skill => (
                      <span key={skill} style={{ padding: '0.25rem 0.75rem', background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-primary)', borderRadius: '99px', fontSize: '0.75rem' }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
           </div>
        </motion.div>

      </div>
    </section>
  );
}
