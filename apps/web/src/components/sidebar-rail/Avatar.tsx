import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { T } from "./motion-tokens";
import css from "./avatar.module.css";

export type AvatarStatus = "online" | "offline";
export type AvatarSize = "sm" | "md" | "lg" | "xl";

export interface AvatarProps extends React.ComponentPropsWithoutRef<"span"> {
  name: string;
  src?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
}

export function Avatar({ name, src, size = "md", status, className, ...rest }: AvatarProps) {
  const fallbackText = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const reduced = useReducedMotion();
  const imageRef = useRef<HTMLImageElement>(null);
  const [failedSrc, setFailedSrc] = useState<string>();

  useLayoutEffect(() => {
    const image = imageRef.current;
    if (image && !image.complete) image.dataset.loading = "";
  }, [src]);

  const showImage = src && failedSrc !== src;

  return (
    <span
      {...rest}
      className={[css.avatar, css[size], className].filter(Boolean).join(" ")}
      role="img"
      aria-label={`${name}${status ? `, ${status}` : ""}`}
    >
      {showImage ? (
        <img
          key={src}
          ref={imageRef}
          src={src}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          onLoad={(event) => {
            delete event.currentTarget.dataset.loading;
          }}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span className={src ? css.fallback : undefined} aria-hidden="true">
          {fallbackText}
        </span>
      )}
      <AnimatePresence initial={false}>
        {status && (
          <motion.i
            key={status}
            className={[css.status, css[status]].join(" ")}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 0.6,
              transition: { duration: reduced ? 0 : T.duration.fast },
            }}
            transition={reduced ? { duration: 0 } : T.spring.snappy}
          />
        )}
      </AnimatePresence>
    </span>
  );
}
