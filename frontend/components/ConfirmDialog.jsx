import React from "react";

/**
 * Themed confirmation popup.
 *
 * Usage:
 *   const [dialog, setDialog] = useState(null);
 *   ...
 *   setDialog({
 *     message: "Delete this game?",
 *     confirmLabel: "Delete",
 *     confirmStyle: "danger", // or "primary" (default)
 *     onConfirm: () => doDelete()
 *   });
 *   ...
 *   {dialog && <ConfirmDialog dialog={dialog} onClose={() => setDialog(null)} />}
 */
export default function ConfirmDialog({ dialog, onClose }) {
  const { message, onConfirm, confirmLabel, confirmStyle } = dialog;
  return (
    <div className="confirmOverlay" onClick={onClose}>
      <div className="confirmContent" onClick={(e) => e.stopPropagation()}>
        <p className="confirmMessage">{message}</p>
        <div className="confirmActions">
          <button className="confirmCancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`confirmYes ${confirmStyle === "danger" ? "danger" : ""}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
