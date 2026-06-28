import { cn } from "@/lib/utils";

const ICON_SRC = "/brand/icon1.png";
const WORDMARK_SRC = "/brand/icologo.png";

/**
 * Marca NegoInversiones.
 *  - `collapsed`: solo el isotipo (flor) — barras estrechas, loaders, favicon.
 *  - completo: isotipo + wordmark "NEGO INVERSIONES".
 *  - `onDark`: invierte el wordmark a blanco para fondos oscuros (panel de login).
 */
export function Logo({
  collapsed = false,
  onDark = false,
  className,
  iconClassName,
}: {
  collapsed?: boolean;
  onDark?: boolean;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src={ICON_SRC}
        alt={collapsed ? "NegoInversiones" : ""}
        aria-hidden={collapsed ? undefined : true}
        width={36}
        height={36}
        draggable={false}
        className={cn(
          "h-9 w-9 shrink-0 select-none object-contain",
          iconClassName
        )}
      />
      {!collapsed && (
        <img
          src={WORDMARK_SRC}
          alt="NegoInversiones"
          width={64}
          height={22}
          draggable={false}
          style={onDark ? { filter: "brightness(0) invert(1)" } : undefined}
          className="h-5.5 w-auto select-none object-contain"
        />
      )}
    </span>
  );
}
