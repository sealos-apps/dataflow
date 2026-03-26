import { createContext, useContext } from "react";
import type { TreeNodeData } from "./types";

interface TreeContextValue {
  expandedItems: Set<string>;
  selectedItemId: string | null;
  loadingItems: Record<string, boolean>;
  treeData: Record<string, TreeNodeData[]>;
  /** Connection.type (e.g. "MYSQL") for the current tree's root connection */
  connectionDbType: string;
  onItemClick: (node: TreeNodeData) => void;
  onToggle: (node: TreeNodeData) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNodeData) => void;
}

const TreeCtx = createContext<TreeContextValue | null>(null);

export const TreeProvider = TreeCtx.Provider;

export function useTreeContext(): TreeContextValue {
  const ctx = useContext(TreeCtx);
  if (!ctx) throw new Error("useTreeContext must be used within TreeProvider");
  return ctx;
}
