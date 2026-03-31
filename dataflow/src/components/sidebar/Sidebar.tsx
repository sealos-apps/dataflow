import React, { useState, useCallback, useReducer } from "react";

import { useConnectionStore } from "@/stores/useConnectionStore";
import { useTabStore } from "@/stores/useTabStore";
import { ContextMenu } from "../ui/ContextMenu";
import type { Alert } from "@/components/ui/types";

import type { TreeNodeData } from "./SidebarTree/types";
import { connectionToNode, EXPANDABLE_TYPES } from "./SidebarTree/types";
import { SidebarTreeProvider, useSidebarTree, TreeNode, TreeNodeProvider } from "./SidebarTree";
import {
  getConnectionMenuItems,
  getDatabaseMenuItems,
  getSchemaMenuItems,
  getTableMenuItems,
  getCollectionMenuItems,
  getViewMenuItems,
} from "./contextMenuItems";
import { SidebarModals } from "./SidebarModals";

// ── Modal reducer (inlined from former useSidebarModals) ────────────

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
  | { type: "export_database"; params: { connectionId: string; databaseName: string; schema: string } }
  | { type: "clear_table_data"; params: { connectionId: string; databaseName: string; schema?: string; tableName: string } }
  | { type: "copy_table"; params: { connectionId: string; databaseName: string; schema?: string; tableName: string } }
  | { type: "rename_table"; params: { connectionId: string; databaseName: string; schema?: string; tableName: string } }
  | { type: "export_collection"; params: { connectionId: string; databaseName: string; collectionName: string } }
  | { type: "drop_collection"; params: { connectionId: string; databaseName: string; collectionName: string } };

type Action =
  | { action: "open"; modal: ModalState }
  | { action: "close" };

function modalReducer(_state: ModalState | null, action: Action): ModalState | null {
  if (action.action === "close") return null;
  return action.modal;
}

// ── Sidebar inner (consumes SidebarTreeProvider context) ────────────

interface SidebarProps {
  onRefreshCollection?: () => void;
}

function SidebarInner({ onRefreshCollection }: SidebarProps) {
  const { connections, selectedItem, selectItem, systemSchemas, showSystemObjectsFor, toggleSystemObjects } = useConnectionStore();
  const { openTab } = useTabStore();

  const {
    expandedItems, treeData, isLoading,
    toggleItem, fetchNodeChildren, refreshNode,
  } = useSidebarTree();

  // Modal state (inlined from former useSidebarModals)
  const [activeModal, dispatch] = useReducer(modalReducer, null);
  const [alert, setAlert] = useState<Alert | null>(null);

  const openModal = useCallback(
    (modal: ModalState) => dispatch({ action: "open", modal }),
    []
  );
  const closeModal = useCallback(
    () => dispatch({ action: "close" }),
    []
  );

  const showAlert = useCallback(
    (title: string, message: string, type: Alert["type"]) =>
      setAlert({ title, message, type }),
    []
  );
  const closeAlert = useCallback(() => setAlert(null), []);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: TreeNodeData;
  } | null>(null);

  const handleItemClick = useCallback(
    async (node: TreeNodeData) => {
      selectItem(node);

      if (EXPANDABLE_TYPES.has(node.type)) {
        try {
          await toggleItem(node);
        } catch (error: any) {
          if (node.type === "connection") {
            showAlert(
              "Connection Failed",
              error.message || "Failed to connect to database. Please check your connection settings.",
              "error",
            );
          }
        }
      }

      if (node.type === "table" || node.type === "view") {
        openTab({
          type: "table",
          title: node.name,
          connectionId: node.connectionId,
          databaseName: node.metadata.database,
          schemaName: node.metadata.schema,
          tableName: node.name,
        });
      } else if (node.type === "collection") {
        openTab({
          type: "collection",
          title: node.name,
          connectionId: node.connectionId,
          databaseName: node.metadata.database,
          collectionName: node.name,
        });
        onRefreshCollection?.();
      } else if (node.type === "redis_keys_list") {
        openTab({
          type: "redis_keys_list",
          title: `${node.metadata.database} Keys`,
          connectionId: node.connectionId,
          databaseName: node.metadata.database,
        });
      }
    },
    [selectItem, toggleItem, showAlert, openTab, onRefreshCollection],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, node: TreeNodeData) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, node });
    },
    [],
  );

  const handleContextMenuAction = useCallback(
    (action: string) => {
      if (!contextMenu) return;
      const { node } = contextMenu;

      switch (action) {
        case "new_query": {
          const queryConnectionId = node.connectionId || node.id;
          const queryDatabaseName =
            node.metadata?.database || (node.type === "database" ? node.name : undefined);
          const querySchemaName = node.metadata?.schema;
          const queryTitle = queryDatabaseName
            ? `Query - ${queryDatabaseName}`
            : `Query - ${connections.find((c) => c.id === queryConnectionId)?.name || "Untitled"}`;
          openTab({
            type: "query",
            title: queryTitle,
            connectionId: queryConnectionId,
            databaseName: queryDatabaseName,
            schemaName: querySchemaName,
          });
          break;
        }
        case "new_database":
          openModal({ type: "create_database", params: { connectionId: node.id } });
          break;
        case "new_table":
          openModal({
            type: "create_table",
            params: {
              connectionId: node.connectionId,
              databaseName: node.type === "database" ? node.name : node.metadata.database!,
              schema: node.type === "schema" ? node.name : undefined,
            },
          });
          break;
        case "new_collection":
          openModal({
            type: "create_collection",
            params: {
              connectionId: node.connectionId,
              databaseName: node.name,
            },
          });
          break;
        case "edit_database":
          openModal({
            type: "edit_database",
            params: { connectionId: node.connectionId, databaseName: node.name },
          });
          break;
        case "delete_database":
          openModal({
            type: "delete_database",
            params: { connectionId: node.connectionId, databaseName: node.name },
          });
          break;
        case "edit_table":
          openModal({
            type: "edit_table",
            params: {
              connectionId: node.connectionId,
              databaseName: node.metadata.database!,
              schema: node.metadata?.schema,
              tableName: node.name,
            },
          });
          break;
        case "delete_table":
          openModal({
            type: "delete_table",
            params: {
              connectionId: node.connectionId,
              databaseName: node.metadata.database!,
              schema: node.metadata?.schema,
              tableName: node.name,
            },
          });
          break;
        case "export_data":
          openModal({
            type: "export_data",
            params: {
              connectionId: node.connectionId,
              databaseName: node.metadata.database!,
              schema: node.metadata.schema || null,
              tableName: node.name,
            },
          });
          break;
        case "export_database": {
          const conn = connections.find(c => c.id === node.connectionId);
          const dbType = conn?.type ?? '';
          const schema = dbType === 'POSTGRES' ? 'public' : dbType === 'MYSQL' || dbType === 'CLICKHOUSE' ? node.name : '';
          openModal({
            type: "export_database",
            params: { connectionId: node.connectionId, databaseName: node.name, schema },
          });
          break;
        }
        case "clear_table_data":
          openModal({
            type: "clear_table_data",
            params: {
              connectionId: node.connectionId,
              databaseName: node.metadata.database!,
              schema: node.metadata?.schema,
              tableName: node.name,
            },
          });
          break;
        case "copy_table":
          openModal({
            type: "copy_table",
            params: {
              connectionId: node.connectionId,
              databaseName: node.metadata.database!,
              schema: node.metadata?.schema,
              tableName: node.name,
            },
          });
          break;
        case "rename_table":
          openModal({
            type: "rename_table",
            params: {
              connectionId: node.connectionId,
              databaseName: node.metadata.database!,
              schema: node.metadata?.schema,
              tableName: node.name,
            },
          });
          break;
        case "export_collection":
          openModal({
            type: "export_collection",
            params: {
              connectionId: node.connectionId,
              databaseName: node.metadata.database!,
              collectionName: node.name,
            },
          });
          break;
        case "drop_collection":
          openModal({
            type: "drop_collection",
            params: {
              connectionId: node.connectionId,
              databaseName: node.metadata.database!,
              collectionName: node.name,
            },
          });
          break;
        case "refresh":
          if (expandedItems.has(node.id)) {
            fetchNodeChildren(node);
          } else {
            toggleItem(node);
          }
          break;
        case "toggle_system_objects":
          toggleSystemObjects(node.id);
          // Re-fetch this node's children with the new filter
          if (expandedItems.has(node.id)) {
            fetchNodeChildren(node);
          }
          break;
      }

      setContextMenu(null);
    },
    [
      contextMenu, connections, openTab, openModal,
      expandedItems, fetchNodeChildren, toggleItem,
      toggleSystemObjects,
    ],
  );

  // Determine context menu items based on the right-clicked node type
  const contextMenuItems = (() => {
    if (!contextMenu) return [];
    const { node } = contextMenu;
    const callbacks = {
      onAction: handleContextMenuAction,
    };

    const nodeId = node.type === "connection" ? node.id : node.id;
    const sysState = { systemSchemas, showSystemObjects: showSystemObjectsFor.has(nodeId) };

    switch (node.type) {
      case "connection":
        return getConnectionMenuItems(
          connections.find((c) => c.id === node.id)!.type,
          callbacks,
          sysState,
        );
      case "database":
        return getDatabaseMenuItems(
          connections.find((c) => c.id === node.connectionId)!.type,
          callbacks,
          sysState,
        );
      case "schema":
        return getSchemaMenuItems(callbacks);
      case "table":
        return getTableMenuItems(callbacks);
      case "view":
        return getViewMenuItems(callbacks);
      case "collection":
        return getCollectionMenuItems(callbacks);
      default:
        return [];
    }
  })();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-background">
      {/* Header */}
      <div className="flex items-center p-4 border-b h-14 shrink-0">
        <h2 className="font-semibold text-sm">{"\u6570\u636e\u5e93\u8fde\u63a5"}</h2>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        {connections.map((conn) => (
          <TreeNodeProvider
            key={conn.id}
            value={{
              selectedItemId: selectedItem?.id ?? null,
              connectionDbType: conn.type,
              onItemClick: handleItemClick,
              onToggle: toggleItem,
              onContextMenu: handleContextMenu,
            }}
          >
            <TreeNode node={connectionToNode(conn)} depth={0} />
          </TreeNodeProvider>
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={contextMenuItems}
        />
      )}

      <SidebarModals
        activeModal={activeModal}
        closeModal={closeModal}
        alert={alert}
        closeAlert={closeAlert}
        refreshNode={refreshNode}
      />
    </div>
  );
}

// ── Public Sidebar (wraps with SidebarTreeProvider) ─────────────────

export function Sidebar({ onRefreshCollection }: SidebarProps) {
  return (
    <SidebarTreeProvider>
      <SidebarInner onRefreshCollection={onRefreshCollection} />
    </SidebarTreeProvider>
  );
}
