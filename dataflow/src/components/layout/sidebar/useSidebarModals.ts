import { useReducer, useCallback, useState } from "react";

/** All possible modal types and their parameter shapes */
export type ModalState =
  | { type: "create_database"; params: { connectionId: string } }
  | { type: "create_table"; params: { connectionId: string; databaseName: string; schema?: string } }
  | { type: "create_collection"; params: { connectionId: string; databaseName: string } }
  | { type: "edit_database"; params: { connectionId: string; databaseName: string } }
  | { type: "delete_database"; params: { connectionId: string; databaseName: string } }
  | { type: "edit_table"; params: { connectionId: string; databaseName: string; schema?: string; tableName: string } }
  | { type: "delete_table"; params: { connectionId: string; databaseName: string; schema?: string; tableName: string } }
  | { type: "export_data"; params: { connectionId: string; databaseName: string; schema: string | null; tableName: string } }
  | { type: "export_database"; params: { connectionId: string; databaseName: string } }
  | { type: "clear_table_data"; params: { connectionId: string; databaseName: string; schema?: string; tableName: string } }
  | { type: "copy_table"; params: { connectionId: string; databaseName: string; schema?: string; tableName: string } }
  | { type: "rename_table"; params: { connectionId: string; databaseName: string; schema?: string; tableName: string } }
  | { type: "export_collection"; params: { connectionId: string; databaseName: string; collectionName: string } }
  | { type: "drop_collection"; params: { connectionId: string; databaseName: string; collectionName: string } };

type Action =
  | { action: "open"; modal: ModalState }
  | { action: "close" };

function reducer(_state: ModalState | null, action: Action): ModalState | null {
  if (action.action === "close") return null;
  return action.modal;
}

/** Alert modal state — separate from the main modal because alerts can overlay on top */
export interface AlertState {
  isOpen: boolean;
  title: string;
  message: string;
  type: "success" | "error" | "info";
}

const INITIAL_ALERT: AlertState = { isOpen: false, title: "", message: "", type: "info" };

export function useSidebarModals() {
  const [activeModal, dispatch] = useReducer(reducer, null);
  const [alertState, setAlertState] = useState<AlertState>(INITIAL_ALERT);

  const openModal = useCallback(
    (modal: ModalState) => dispatch({ action: "open", modal }),
    []
  );
  const closeModal = useCallback(
    () => dispatch({ action: "close" }),
    []
  );

  const showAlert = useCallback(
    (title: string, message: string, type: AlertState["type"]) =>
      setAlertState({ isOpen: true, title, message, type }),
    []
  );
  const closeAlert = useCallback(
    () => setAlertState((prev) => ({ ...prev, isOpen: false })),
    []
  );

  return { activeModal, openModal, closeModal, alertState, showAlert, closeAlert };
}
