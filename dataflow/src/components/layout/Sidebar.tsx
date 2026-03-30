import React, { useState, useCallback } from "react";

import { useConnectionStore } from "@/stores/useConnectionStore";
import { useTabStore } from "@/stores/useTabStore";
import { ContextMenu } from "../ui/ContextMenu";

import type { TreeNodeData } from "./sidebar/types";
import { connectionToNode, EXPANDABLE_TYPES } from "./sidebar/types";
import { useSidebarTree } from "./sidebar/useSidebarTree";
import { useSidebarModals } from "./sidebar/useSidebarModals";
import {
  getConnectionMenuItems,
  getDatabaseMenuItems,
  getSchemaMenuItems,
  getTableMenuItems,
  getCollectionMenuItems,
  getViewMenuItems,
} from "./sidebar/contextMenuItems";
import { TreeProvider } from "./sidebar/TreeContext";
import { TreeNode } from "./sidebar/TreeNode";
import { SidebarModals } from "./sidebar/SidebarModals";

interface SidebarProps {
  onRefreshCollection?: () => void;
}

export function Sidebar({ onRefreshCollection }: SidebarProps) {
  const { connections, selectedItem, selectItem, systemSchemas, showSystemObjectsFor, toggleSystemObjects } = useConnectionStore();
  const { openTab } = useTabStore();

  const {
    expandedItems, treeData, isLoading,
    toggleItem, fetchNodeChildren, refreshNode,
  } = useSidebarTree();

  const {
    activeModal, openModal, closeModal,
    alertState, showAlert, closeAlert,
  } = useSidebarModals();

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
        <h2 className="font-semibold text-sm">数据库连接</h2>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        {connections.map((conn) => (
          <TreeProvider
            key={conn.id}
            value={{
              expandedItems,
              selectedItemId: selectedItem?.id ?? null,
              loadingItems: isLoading,
              treeData,
              connectionDbType: conn.type,
              onItemClick: handleItemClick,
              onToggle: toggleItem,
              onContextMenu: handleContextMenu,
            }}
          >
            <TreeNode node={connectionToNode(conn)} depth={0} />
          </TreeProvider>
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
        alertState={alertState}
        closeAlert={closeAlert}
        refreshNode={refreshNode}
      />
    </div>
  );
}
