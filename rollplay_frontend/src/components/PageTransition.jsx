// src/components/PageTransition.jsx
import { useEffect, useState } from "react";

/**
 * Full-screen beer-bubble wall that briefly covers page transitions.
 * 
 * Usage:
 *   <PageTransition path={location.pathname} />
 *
 * Every time `path` changes, the overlay animates in/out.
 */
export default function PageTransition({ path }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger overlay when path changes
    setVisible(true);

    const timeout = setTimeout(() => {
      setVisible(false);
    }, 900); // duration should match CSS animation

    return () => clearTimeout(timeout);
  }, [path]);
  

  if (!visible) return null;

  // Just some fixed bubbles – CSS will animate them upwards
  const bubbles = Array.from({ length: 20 });

  return (
    <div className="page-transition-overlay">
      <div className="page-transition-foam" />
      <div className="page-transition-beer">
        {bubbles.map((_, i) => (
          <div key={i} className="page-transition-bubble" />
        ))}
      </div>
    </div>
  );
}
