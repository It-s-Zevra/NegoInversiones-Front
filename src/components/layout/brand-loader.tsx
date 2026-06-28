import {
  Home,
  Building2,
  KeyRound,
  TrendingUp,
  Coins,
  Handshake,
  FileText,
  MapPin,
} from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Iconos del negocio que orbitan el isotipo (inmobiliaria · inversión). */
const ORBIT = [
  { Icon: Home, tone: "text-primary" },
  { Icon: Building2, tone: "text-warning" },
  { Icon: KeyRound, tone: "text-primary" },
  { Icon: TrendingUp, tone: "text-warning" },
  { Icon: Coins, tone: "text-primary" },
  { Icon: Handshake, tone: "text-warning" },
  { Icon: FileText, tone: "text-primary" },
  { Icon: MapPin, tone: "text-warning" },
];

const RADIUS = 104; // px desde el centro hasta cada chip

/**
 * Pantalla de carga de marca: el isotipo gira en el centro sobre fondo blanco,
 * rodeado por una órbita de iconos del negocio que aparecen de forma escalonada.
 * Respeta `prefers-reduced-motion` (se muestra estático).
 */
export function BrandLoader({
  caption = "Cargando…",
  fullScreen = false,
  className,
}: {
  caption?: string;
  fullScreen?: boolean;
  className?: string;
}) {
  const unit = (
    <div
      className="flex flex-col items-center"
      role="status"
      aria-live="polite"
    >
      <div className="relative h-64 w-64">
        {/* Resplandor suave detrás del isotipo */}
        <div className="bl-glow pointer-events-none absolute inset-0 m-auto h-32 w-32 rounded-full bg-primary/15 blur-2xl" />

        {/* Trayectoria de la órbita (decorativa) */}
        <div className="pointer-events-none absolute inset-0 m-auto h-52 w-52 rounded-full border border-dashed border-border" />

        {/* Iconos en órbita */}
        <div className="bl-ring absolute inset-0">
          {ORBIT.map(({ Icon, tone }, i) => (
            <span
              key={i}
              className="bl-item absolute left-1/2 top-1/2"
              style={
                {
                  "--bl-a": `${(360 / ORBIT.length) * i}deg`,
                  "--bl-r": `${RADIUS}px`,
                } as CSSProperties
              }
            >
              <span className="bl-spin-c block">
                <span
                  className="bl-chip grid h-10 w-10 place-items-center rounded-2xl bg-surface shadow-pop ring-1 ring-border"
                  style={{ "--bl-delay": `${0.12 * i}s` } as CSSProperties}
                >
                  <Icon
                    className={cn("h-4.5 w-4.5", tone)}
                    strokeWidth={2}
                    aria-hidden
                  />
                </span>
              </span>
            </span>
          ))}
        </div>

        {/* Isotipo girando */}
        <img
          src="/brand/icon1.png"
          alt=""
          aria-hidden
          width={84}
          height={84}
          draggable={false}
          className="bl-flower absolute inset-0 m-auto h-21 w-21 select-none object-contain drop-shadow-sm"
        />
      </div>

      <img
        src="/brand/icologo.png"
        alt=""
        aria-hidden
        width={132}
        height={45}
        draggable={false}
        className="bl-caption mt-1 h-7 w-auto select-none object-contain opacity-90"
        style={{ animationDelay: "0.1s" }}
      />
      <p
        className="bl-caption mt-2 text-sm text-muted"
        style={{ animationDelay: "0.2s" }}
      >
        {caption}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className={cn(
          "grid min-h-dvh place-items-center bg-surface",
          className
        )}
      >
        {unit}
      </div>
    );
  }

  return <div className={cn("grid place-items-center", className)}>{unit}</div>;
}
