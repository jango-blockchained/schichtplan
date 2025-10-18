import { cn } from "@/lib/utils";
import React, { useEffect, useRef, useState } from "react";
import "./effects.css";

// Shiny text effect component with intersection observer
interface ShinyTextProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "grey" | "gold" | "blue";
  triggerOnView?: boolean;
}

export const ShinyText = ({
  children,
  className,
  variant = "default",
  triggerOnView = true,
}: ShinyTextProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!triggerOnView) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setIsVisible(true);
            setHasAnimated(true);
            // After the animation completes (30s), allow it to trigger again
            setTimeout(() => {
              setHasAnimated(false);
              setIsVisible(false);
            }, 30000);
          }
        });
      },
      {
        threshold: 0.1, // Trigger when 10% of the element is visible
        rootMargin: "50px",
      },
    );

    const currentElement = elementRef.current;
    if (currentElement) {
      observer.observe(currentElement);
    }

    return () => {
      if (currentElement) {
        observer.unobserve(currentElement);
      }
    };
  }, [triggerOnView, hasAnimated]);

  return (
    <div
      ref={elementRef}
      className={cn(
        "shiny-text",
        variant !== "default" && `shiny-text--${variant}`,
        isVisible && triggerOnView && "shiny-text--animate",
        className,
      )}
    >
      {children}
    </div>
  );
};
