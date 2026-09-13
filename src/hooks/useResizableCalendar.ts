import { KeyboardEvent, PointerEvent, useEffect, useLayoutEffect, useRef, useState } from "react";

export const CALENDAR_MIN_WIDTH = 340;
export const CALENDAR_DEFAULT_WIDTH = 400;

export function useResizableCalendar() {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; width: number; max: number } | null>(null);
  const [calendarWidth, setCalendarWidth] = useState(CALENDAR_DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);

  const clampCalendarWidth = (width: number, board = boardRef.current) => {
    const max = Math.max(CALENDAR_MIN_WIDTH, Math.floor((board?.clientWidth ?? width * 2) / 2));
    return Math.min(max, Math.max(CALENDAR_MIN_WIDTH, width));
  };

  useLayoutEffect(() => {
    setCalendarWidth((width) => clampCalendarWidth(width));
  }, []);

  useEffect(() => {
    const onResize = () => setCalendarWidth((width) => clampCalendarWidth(width));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onResizePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    const board = boardRef.current;
    if (!board) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
    dragRef.current = {
      x: event.clientX,
      width: calendarWidth,
      max: Math.max(CALENDAR_MIN_WIDTH, Math.floor(board.clientWidth / 2)),
    };
  };

  const onResizePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = drag.width + (drag.x - event.clientX);
    setCalendarWidth(Math.min(drag.max, Math.max(CALENDAR_MIN_WIDTH, next)));
  };

  const onResizePointerUp = () => {
    dragRef.current = null;
    setResizing(false);
  };

  const nudgeCalendar = (delta: number) => {
    setCalendarWidth((width) => clampCalendarWidth(width + delta));
  };

  return {
    boardRef,
    calendarWidth,
    resizing,
    boardStyle: { ["--stats-cal-width" as string]: `${calendarWidth}px` },
    resizeHandlers: {
      onPointerDown: onResizePointerDown,
      onPointerMove: onResizePointerMove,
      onPointerUp: onResizePointerUp,
      onPointerCancel: onResizePointerUp,
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          nudgeCalendar(24);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          nudgeCalendar(-24);
        }
      },
    },
  };
}
