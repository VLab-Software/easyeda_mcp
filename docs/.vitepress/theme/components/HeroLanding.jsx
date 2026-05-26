import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronRight } from "lucide-react"

const logos = [
  {
    src: "https://svgl.app/library/claude.svg",
    alt: "Claude Desktop",
    gradient: { from: "#FF6B00", to: "#FFB347" }
  },
  {
    src: "https://svgl.app/library/codex.svg",
    alt: "Codex",
    gradient: { from: "#7C3AED", to: "#A855F7" }
  },
  {
    src: "https://svgl.app/library/vscode.svg",
    alt: "VS Code",
    gradient: { from: "#007ACC", to: "#00BCF2" }
  }
]

function LogoCard({ logo }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        height: 96,
        width: 160,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 9999,
        background: "white",
        border: `1px solid ${hovered ? "#cbd5e1" : "rgba(203,213,225,0.6)"}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        overflow: "hidden",
        cursor: "default",
        transition: "border-color 0.2s ease"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${logo.gradient.from}, ${logo.gradient.to})`,
          opacity: hovered ? 1 : 0,
          transform: hovered ? "scale(1)" : "scale(1.5)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
          borderRadius: 9999
        }}
      />
      <img
        src={logo.src}
        alt={logo.alt}
        style={{
          width: 40,
          height: 40,
          objectFit: "contain",
          position: "relative",
          zIndex: 1,
          filter: hovered ? "brightness(0) invert(1)" : "none",
          transition: "filter 0.3s ease"
        }}
      />
    </div>
  )
}

function Marquee() {
  const items = [...logos, ...logos, ...logos, ...logos]
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        maskImage:
          "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 12%, black 88%, transparent)"
      }}
    >
      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          gap: 12px;
          width: max-content;
          animation: marquee-scroll 22s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div className="marquee-track">
        {items.map((logo, i) => (
          <LogoCard key={i} logo={logo} />
        ))}
      </div>
    </div>
  )
}

function usePendulumVideo(speed = 0.45, turnAt = 0.88) {
  const videoRef = useRef(null)
  const dirRef = useRef(1)      // 1 = forward, -1 = reverse
  const rafRef = useRef(null)

  const attach = useCallback(node => {
    videoRef.current = node
    if (!node) return

    node.pause()

    const RATE = speed               // playback speed multiplier
    const TURN = turnAt              // fraction of duration to reverse at
    const FPS  = 60                  // target tick rate

    function tick() {
      const v = videoRef.current
      if (!v || !v.duration) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const ratio = v.currentTime / v.duration

      // switch direction at boundaries
      if (dirRef.current === 1 && ratio >= TURN) {
        dirRef.current = -1
      } else if (dirRef.current === -1 && v.currentTime <= 0.02) {
        dirRef.current = 1
        v.currentTime = 0
      }

      const step = (1 / FPS) * RATE * dirRef.current
      v.currentTime = Math.max(0, Math.min(v.duration * TURN + 0.05, v.currentTime + step))

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [speed, turnAt])

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return attach
}

export default function HeroLanding() {
  const [visible, setVisible] = useState(false)
  const [navHover, setNavHover] = useState(null)
  const videoCallback = usePendulumVideo(0.45, 0.88)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  const fadeIn = (delay = 0) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(18px)",
    transition: `opacity 0.75s ease ${delay}s, transform 0.75s ease ${delay}s`
  })

  return (
    <div
      style={{
        background: "#f9fafb",
        minHeight: "100vh",
        padding: "32px 16px 48px",
        fontFamily: "Inter, sans-serif"
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600&display=swap');
      `}</style>

      {/* ── Hero container ── */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 1400,
          margin: "0 auto",
          borderRadius: 48,
          background: "white",
          border: "1px solid rgba(226,232,240,0.5)",
          boxShadow: "0 40px 100px -20px rgba(0,0,0,0.03)",
          overflow: "hidden",
          height: 600,
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* Video background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            overflow: "hidden",
            userSelect: "none"
          }}
        >
          <video
            ref={videoCallback}
            muted
            playsInline
            preload="auto"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scale(1.05)"
            }}
            src="/easyeda_mcp/hero-bg.mp4"
          />
        </div>

        {/* Text content */}
        <div
          style={{
            position: "relative",
            zIndex: 20,
            flex: 1,
            padding: "64px 80px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            ...fadeIn(0)
          }}
        >
          <h1
            style={{
              fontFamily: "Outfit, sans-serif",
              fontSize: 56,
              fontWeight: 500,
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              color: "#0a1b33",
              marginBottom: 20,
              margin: "0 0 20px"
            }}
          >
            Foundation of the
            <br />
            new digital epoch
          </h1>

          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 15,
              color: "#64748b",
              maxWidth: 460,
              lineHeight: 1.65,
              margin: "0 0 32px"
            }}
          >
            Designing products, powering ecosystems and laying the foundation of
            a decentralized web for enterprises, builders and communities alike.
          </p>

          <button
            onMouseEnter={e => {
              e.currentTarget.style.transform = "scale(1.04)"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "scale(1)"
            }}
            style={{
              background: "#0a152d",
              color: "white",
              border: "none",
              borderRadius: 9999,
              padding: "13px 28px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              transition: "transform 0.18s ease",
              letterSpacing: "0.01em"
            }}
          >
            Contact Us
          </button>
        </div>

        {/* Floating bottom navbar */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 30,
            ...fadeIn(0.28)
          }}
        >
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              background: "rgba(255,255,255,0.90)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              padding: "6px 6px",
              borderRadius: 9999,
              boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
              border: "1px solid rgba(226,232,240,0.4)",
              whiteSpace: "nowrap"
            }}
          >
            {/* Logo mark */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "white",
                border: "1px solid #f1f5f9",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                marginRight: 4,
                color: "#0a1b33"
              }}
            >
              ✦
            </div>

            {["Products", "Docs"].map(label => (
              <button
                key={label}
                onMouseEnter={e => {
                  e.currentTarget.style.color = "#0a1b33"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = "#94a3b8"
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#94a3b8",
                  fontFamily: "Inter, sans-serif",
                  borderRadius: 9999,
                  transition: "color 0.15s ease"
                }}
              >
                {label}
              </button>
            ))}

            <button
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "#cbd5e1"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "rgba(203,213,225,0.6)"
              }}
              style={{
                background: "white",
                border: "1px solid rgba(203,213,225,0.6)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                borderRadius: 9999,
                padding: "8px 20px",
                fontSize: 12,
                fontWeight: 600,
                color: "#0a1b33",
                fontFamily: "Inter, sans-serif",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                marginLeft: 4,
                transition: "border-color 0.15s ease"
              }}
            >
              Get in touch
              <ChevronRight size={13} />
            </button>
          </nav>
        </div>
      </div>

      {/* Marquee */}
      <div style={{ marginTop: 40 }}>
        <Marquee />
      </div>
    </div>
  )
}
