import { cn } from "@/lib/utils";
import React, { useEffect, useRef, useState } from "react";

/**
 * AI Assistant Orb - Professional tech-style floating button
 * Features:
 * - Glowing animated orb with gradient core
 * - Reactive to mouse movements
 * - Magnetic mouse interaction
 * - Particle effects on hover
 * - Clean professional aesthetic with AI tech vibe
 */

interface MousePosition {
    x: number;
    y: number;
}

interface Particle {
    id: string;
    x: number;
    y: number;
    scale: number;
    opacity: number;
    vx: number;
    vy: number;
}

export const AIAssistantOrb: React.FC<{
    onClick?: () => void;
    isActive?: boolean;
}> = ({ onClick, isActive = false }) => {
    const orbRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [orbPos, setOrbPos] = useState<MousePosition>({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);
    const [particles, setParticles] = useState<Particle[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const animationFrameRef = useRef<number>();

    const MAGNETIC_RADIUS = 150; // Radius for magnetic effect      // Track mouse position globally
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            // Calculate magnetic attraction
            if (orbRef.current) {
                const orbRect = orbRef.current.getBoundingClientRect();
                const orbCenterX = orbRect.left + orbRect.width / 2;
                const orbCenterY = orbRect.top + orbRect.height / 2;

                const dx = e.clientX - orbCenterX;
                const dy = e.clientY - orbCenterY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < MAGNETIC_RADIUS && distance > 0) {
                    const angle = Math.atan2(dy, dx);
                    const moveX = Math.cos(angle) * Math.min(distance / MAGNETIC_RADIUS, 1) * 15;
                    const moveY = Math.sin(angle) * Math.min(distance / MAGNETIC_RADIUS, 1) * 15;

                    setOrbPos({ x: moveX, y: moveY });

                    // Create particles on near proximity
                    if (distance < MAGNETIC_RADIUS * 0.7 && isHovering && Math.random() > 0.7) {
                        createParticle(orbCenterX, orbCenterY);
                    }
                } else {
                    setOrbPos({ x: 0, y: 0 });
                }
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [isHovering]);

    // Particle creation
    const createParticle = (x: number, y: number) => {
        const particle: Particle = {
            id: `particle-${Date.now()}-${Math.random()}`,
            x,
            y,
            scale: 1,
            opacity: 1,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4 - 1, // Bias upward
        };

        particlesRef.current.push(particle);
        setParticles([...particlesRef.current]);
    };

    // Particle animation loop
    useEffect(() => {
        const animate = () => {
            // Update particles
            particlesRef.current = particlesRef.current
                .map((p) => ({
                    ...p,
                    x: p.x + p.vx,
                    y: p.y + p.vy,
                    vy: p.vy + 0.2, // gravity
                    scale: p.scale * 0.95,
                    opacity: p.opacity * 0.92,
                }))
                .filter((p) => p.opacity > 0.01);

            setParticles([...particlesRef.current]);
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    // Canvas drawing for glow effect
    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = 120;
        canvas.height = 120;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 45;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw outer glow (stronger on hover)
        const glowIntensity = isHovering ? 8 : 4;
        for (let i = glowIntensity; i > 0; i--) {
            ctx.fillStyle = `rgba(59, 130, 246, ${(0.1 * (glowIntensity - i)) / glowIntensity})`;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius + i * 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw core orb with gradient
        const gradient = ctx.createRadialGradient(
            centerX - 15,
            centerY - 15,
            0,
            centerX,
            centerY,
            radius,
        );
        gradient.addColorStop(0, "rgba(147, 197, 253, 1)"); // light blue
        gradient.addColorStop(0.5, "rgba(59, 130, 246, 0.8)"); // medium blue
        gradient.addColorStop(1, "rgba(37, 99, 235, 0.6)"); // dark blue

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw shine/specular highlight
        const shineGradient = ctx.createRadialGradient(
            centerX - 20,
            centerY - 20,
            5,
            centerX - 20,
            centerY - 20,
            30,
        );
        shineGradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
        shineGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.fillStyle = shineGradient;
        ctx.beginPath();
        ctx.arc(centerX - 20, centerY - 20, 30, 0, Math.PI * 2);
        ctx.fill();

        // Draw border ring
        ctx.strokeStyle = `rgba(59, 130, 246, ${isHovering ? 0.8 : 0.4})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
    }, [isHovering]);

    return (
        <div
            ref={containerRef}
            className="fixed bottom-6 right-6 z-40 pointer-events-none"
        >
            {/* Canvas for glow effect */}
            <canvas
                ref={canvasRef}
                className={cn(
                    "absolute inset-0 transition-opacity duration-300",
                    isActive ? "opacity-100" : "opacity-80",
                )}
                style={{
                    width: "120px",
                    height: "120px",
                    top: "-60px",
                    left: "-60px",
                    filter: isHovering ? "drop-shadow(0 0 30px rgba(59, 130, 246, 0.6))" : "drop-shadow(0 0 15px rgba(59, 130, 246, 0.3))",
                    transition: "filter 0.3s ease",
                }}
            />

            {/* Main Orb Button */}
            <div
                ref={orbRef}
                onClick={onClick}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => {
                    setIsHovering(false);
                    setOrbPos({ x: 0, y: 0 });
                }}
                className={cn(
                    "relative w-16 h-16 rounded-full cursor-pointer pointer-events-auto",
                    "flex items-center justify-center",
                    "transition-all duration-300",
                    "group",
                )}
                style={{
                    transform: `translate(${orbPos.x}px, ${orbPos.y}px)`,
                    transitionProperty: "transform",
                    transitionDuration: "0.1s",
                }}
            >
                {/* Background gradient circle */}
                <div
                    className={cn(
                        "absolute inset-0 rounded-full",
                        "bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600",
                        "transition-all duration-300",
                        isHovering && "shadow-[0_0_30px_rgba(59,130,246,0.8)]",
                    )}
                />

                {/* Animated border ring */}
                <div
                    className={cn(
                        "absolute inset-0 rounded-full border-2 border-blue-300",
                        "opacity-40 group-hover:opacity-100 transition-opacity duration-300",
                        isHovering && "animate-spin",
                    )}
                    style={{
                        animationDuration: isHovering ? "3s" : "6s",
                        animationDirection: "reverse",
                    }}
                />

                {/* Icon */}
                <svg
                    className="relative w-8 h-8 text-white drop-shadow-lg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M12 2a10 10 0 0 0 10 10H2A10 10 0 0 0 12 2z" />
                    <path d="M12 8v8m-3-3h6" strokeWidth="1.5" />
                </svg>

                {/* Pulse on active */}
                {isActive && (
                    <>
                        <div
                            className="absolute inset-0 rounded-full border-2 border-blue-300 animate-pulse"
                            style={{
                                animationDuration: "2s",
                            }}
                        />
                        <div
                            className="absolute inset-0 rounded-full border-2 border-blue-300 animate-ping opacity-75"
                            style={{
                                animationDuration: "1.5s",
                            }}
                        />
                    </>
                )}

                {/* Label on hover */}
                {isHovering && (
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                        <div className="bg-gray-900 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-lg border border-blue-400/50">
                            AI Assistant
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -translate-y-1 w-2 h-2 bg-gray-900 border-r border-b border-blue-400/50 rotate-45" />
                        </div>
                    </div>
                )}
            </div>

            {/* Particle effects */}
            {particles.map((particle) => (
                <div
                    key={particle.id}
                    className="absolute w-1 h-1 bg-blue-400 rounded-full pointer-events-none"
                    style={{
                        left: particle.x - 2,
                        top: particle.y - 2,
                        transform: `scale(${particle.scale})`,
                        opacity: particle.opacity,
                        filter: "drop-shadow(0 0 4px rgba(59, 130, 246, 0.8))",
                    }}
                />
            ))}

            {/* Glow background on active */}
            {isActive && (
                <div
                    className="absolute inset-0 rounded-full opacity-20"
                    style={{
                        backgroundColor: "rgb(59, 130, 246)",
                        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                        width: "200px",
                        height: "200px",
                        top: "-92px",
                        left: "-92px",
                    }}
                />
            )}
        </div>
    );
};

export default AIAssistantOrb;
