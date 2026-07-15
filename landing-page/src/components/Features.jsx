"use client";

import { motion } from 'framer-motion';

const features = [
  {
    title: "100% Fact-Locked",
    description: "Your past companies, job titles, dates, education, and certs are locked. The AI only optimizes wording, emphasis, and skill order.",
    icon: "🔒"
  },
  {
    title: "Deterministic ATS Scoring",
    description: "We don't rely on AI to score your resume. We use deterministic algorithms to match priority-weighted skills exactly like an ATS parser does.",
    icon: "📊"
  },
  {
    title: "No Hallucinations",
    description: "A smuggled 'Kubernetes' gets silently dropped. Quality guards ensure you never apply with skills you don't actually possess.",
    icon: "🛡️"
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { y: 30, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  }
};

export default function Features() {
  return (
    <section className="section" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
      <div className="container">
        
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Built for <span className="gradient-text">Trust</span>
          </motion.h2>
          <motion.p 
            className="text-lg"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{ maxWidth: '600px', margin: '0 auto' }}
          >
            Unlike generic AI wrappers, ApplyKro uses strict deterministic boundaries to ensure your resume remains entirely factual.
          </motion.p>
        </div>

        <motion.div 
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {features.map((feature, idx) => (
            <motion.div 
              key={idx}
              variants={itemVariants}
              className="glass"
              style={{
                padding: '2.5rem 2rem',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                position: 'relative',
                overflow: 'hidden'
              }}
              whileHover={{ y: -5, boxShadow: '0 10px 30px -10px rgba(59, 130, 246, 0.3)' }}
            >
              <div style={{
                position: 'absolute',
                top: '-20px',
                right: '-20px',
                width: '100px',
                height: '100px',
                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, rgba(0,0,0,0) 70%)',
                borderRadius: '50%'
              }} />
              
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                {feature.icon}
              </div>
              <h3 style={{ fontSize: '1.5rem', margin: 0 }}>{feature.title}</h3>
              <p style={{ margin: 0 }}>{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}
