import React, { createContext, use } from "react";
import {
  ChevronRight, ChevronDown, Loader2,
  Database, LayoutGrid, Table, Files, List, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TreeNodeData, NodeType } from "./types";
import { EXPANDABLE_TYPES, DB_ICONS, NODE_ICON_COLORS } from "./types";
import { useSidebarTree } from "./SidebarTreeProvider";

/** Per-connection context passed by Sidebar to each connection's tree. */
export interface TreeNodeContextValue {
  selectedItemId: string | null;
  connectionDbType: string;
  onItemClick: (node: TreeNodeData) => void;
  onToggle: (node: TreeNodeData) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNodeData) => void;
}

const TreeNodeCtx = createContext<TreeNodeContextValue | null>(null);

export const TreeNodeProvider = TreeNodeCtx.Provider;

function useTreeNodeContext(): TreeNodeContextValue {
  const ctx = use(TreeNodeCtx);
  if (!ctx) throw new Error("TreeNode must be used within TreeNodeProvider");
  return ctx;
}

const NODE_ICONS: Record<NodeType, React.ComponentType<{ className?: string }>> = {
  connection: Database,
  database: Database,
  schema: LayoutGrid,
  table: Table,
  view: Eye,
  collection: Files,
  redis_keys_list: List,
};

interface TreeNodeProps {
  node: TreeNodeData;
  depth: number;
}

export function TreeNode({ node, depth }: TreeNodeProps) {
  const { expandedItems, isLoading: loadingItems, treeData } = useSidebarTree();
  const {
    selectedItemId,
    connectionDbType,
    onItemClick, onToggle, onContextMenu,
  } = useTreeNodeContext();

  const isExpandable = EXPANDABLE_TYPES.has(node.type);
  const isRoot = depth === 0;
  const isExpanded = expandedItems.has(node.id);
  const isSelected = selectedItemId === node.id;
  const nodeIsLoading = !!loadingItems[node.id];
  const children = treeData[node.id];

  // Redis database nodes get a different icon color
  const iconColor =
    node.type === "database" && connectionDbType === "REDIS"
      ? "text-red-500/80"
      : NODE_ICON_COLORS[node.type];

  const Icon = NODE_ICONS[node.type];
  const brandIcon = isRoot ? DB_ICONS[connectionDbType] : null;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-md text-sm transition-colors cursor-pointer select-none",
          isRoot ? "px-2 py-2" : "px-2 py-1.5",
          isSelected
            ? isRoot
              ? "bg-primary/10 text-primary font-medium"
              : "bg-white text-foreground font-medium shadow-sm ring-1 ring-border/50"
            : isRoot
              ? "text-muted-foreground hover:bg-muted hover:text-foreground"
              : "text-muted-foreground hover:bg-white/60 hover:text-foreground"
        )}
        onClick={() => onItemClick(node)}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {isExpandable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node);
            }}
            className={cn(
              "rounded p-0.5 transition-colors",
              isSelected ? "hover:bg-primary/20" : "hover:bg-muted"
            )}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 opacity-70" />
            )}
          </button>
        )}

        {brandIcon ? (
          <img src={brandIcon} alt={connectionDbType} className="h-4 w-4 shrink-0" />
        ) : (
          <Icon className={cn(isRoot ? "h-4 w-4" : "h-3.5 w-3.5", iconColor)} />
        )}

        <span className="truncate flex-1">{node.name}</span>

        {nodeIsLoading && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        )}
      </div>

      {isExpanded && children && children.length > 0 && (
        <div className="ml-2 pl-2 border-l border-border/50 mt-1 space-y-0.5">
          {children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
