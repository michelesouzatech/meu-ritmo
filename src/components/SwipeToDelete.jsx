import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";

const ACTION_WIDTH = 76;

function SwipeToDelete({ onDelete, deleteLabel = "Excluir", children }) {
  const [dragX, setDragX] = useState(0);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startDragX = useRef(0);
  const pointerId = useRef(null);

  function handlePointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointerId.current = e.pointerId;
    startX.current = e.clientX;
    startDragX.current = dragX;
    setDragging(true);
  }

  function handlePointerMove(e) {
    if (pointerId.current !== e.pointerId) return;
    const delta = e.clientX - startX.current;
    const next = Math.min(0, Math.max(-ACTION_WIDTH - 24, startDragX.current + delta));
    setDragX(next);
  }

  function endDrag(e) {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    setDragging(false);
    if (dragX <= -ACTION_WIDTH * 1.6) {
      onDelete();
      setDragX(0);
      setOpen(false);
      return;
    }
    if (dragX <= -ACTION_WIDTH / 2) {
      setDragX(-ACTION_WIDTH);
      setOpen(true);
    } else {
      setDragX(0);
      setOpen(false);
    }
  }

  function closeAndDelete() {
    onDelete();
    setDragX(0);
    setOpen(false);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center"
        style={{ width: ACTION_WIDTH }}
      >
        <button
          type="button"
          aria-label={deleteLabel}
          onClick={closeAndDelete}
          className="flex h-full w-full items-center justify-center bg-ritmo-pink-deep text-white"
        >
          <Trash2 size={18} />
        </button>
      </div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={(e) => {
          if (open) {
            e.preventDefault();
            e.stopPropagation();
            setDragX(0);
            setOpen(false);
          }
        }}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 0.2s ease",
          touchAction: "pan-y",
        }}
        className="relative"
      >
        {children}
      </div>
    </div>
  );
}

export default SwipeToDelete;
