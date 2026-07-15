import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Pipeline from "@/components/Pipeline";

export default function Home() {
  return (
    <main>
      <Header />
      <Hero />
      <Features />
      <Pipeline />
      
      {/* Footer */}
      <footer style={{ padding: '3rem 2rem', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
        <div className="container">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Ready to beat the ATS?</h2>
          <button className="btn btn-primary" style={{ marginBottom: '2rem' }}>Install ApplyKro Extension</button>
          
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            &copy; {new Date().getFullYear()} ApplyKro. The ATS-friendly AI Resume Tailor. Built for Trust.
          </p>
        </div>
      </footer>
    </main>
  );
}
