import React from "react";
import {
  Terminal, Plus, Download, Edit2, Trash2,
  RefreshCw, Eraser, Copy, Eye, EyeOff,
} from "lucide-react";
import type { ContextMenuItem } from "@/components/ui/ContextMenu";

type ConnectionType = "MYSQL" | "POSTGRES" | "MONGODB" | "REDIS" | "CLICKHOUSE";

interface MenuCallbacks {
  onAction: (action: string) => void;
}

interface SystemObjectsState {
  systemSchemas: string[];
  showSystemObjects: boolean;
}

function refreshItem(onAction: (action: string) => void): ContextMenuItem {
  return { label: "Refresh", onClick: () => onAction("refresh"), icon: React.createElement(RefreshCw, { className: "h-4 w-4" }) };
}

export function getConnectionMenuItems(
  connectionType: ConnectionType,
  callbacks: MenuCallbacks,
  systemObjectsState?: SystemObjectsState
): ContextMenuItem[] {
  const { onAction } = callbacks;
  // Connection-level toggle only applies to types where systemSchemas are
  // database names (MongoDB, MySQL, ClickHouse). For Postgres, systemSchemas
  // are schema names — the toggle belongs at the database level instead.
  const systemItems: ContextMenuItem[] = connectionType !== "POSTGRES" && systemObjectsState && systemObjectsState.systemSchemas.length > 0
    ? [
        { separator: true },
        {
          label: systemObjectsState.showSystemObjects ? "隐藏系统对象" : "显示系统对象",
          onClick: () => onAction("toggle_system_objects"),
          icon: React.createElement(
            systemObjectsState.showSystemObjects ? EyeOff : Eye,
            { className: "h-4 w-4" }
          ),
        },
      ]
    : [];
  return [
    { label: "New Query", onClick: () => onAction("new_query"), icon: React.createElement(Terminal, { className: "h-4 w-4" }) },
    { separator: true },
    ...(connectionType !== "REDIS"
      ? [
          { label: "New Database", onClick: () => onAction("new_database"), icon: React.createElement(Plus, { className: "h-4 w-4" }) },
        ] as ContextMenuItem[]
      : []),
    { separator: true },
    refreshItem(onAction),
    ...systemItems,
  ];
}

export function getDatabaseMenuItems(
  connectionType: ConnectionType,
  callbacks: MenuCallbacks,
  systemObjectsState?: SystemObjectsState
): ContextMenuItem[] {
  const { onAction } = callbacks;
  // Database-level toggle only applies to Postgres where systemSchemas are
  // schema names filtered within a database. For other types, collections/tables
  // have no frontend-level system object filtering.
  const systemItems: ContextMenuItem[] = connectionType === "POSTGRES" && systemObjectsState && systemObjectsState.systemSchemas.length > 0
    ? [
        { separator: true },
        {
          label: systemObjectsState.showSystemObjects ? "隐藏系统对象" : "显示系统对象",
          onClick: () => onAction("toggle_system_objects"),
          icon: React.createElement(
            systemObjectsState.showSystemObjects ? EyeOff : Eye,
            { className: "h-4 w-4" }
          ),
        },
      ]
    : [];
  return [
    { label: "New Query", onClick: () => onAction("new_query"), icon: React.createElement(Terminal, { className: "h-4 w-4" }) },
    { separator: true },
    ...(connectionType === "MONGODB"
      ? [
          { label: "New Collection", onClick: () => onAction("new_collection"), icon: React.createElement(Plus, { className: "h-4 w-4" }) },
          { separator: true },
          { label: "Export Database", onClick: () => onAction("export_database"), icon: React.createElement(Download, { className: "h-4 w-4" }) },
          { separator: true },
        ] as ContextMenuItem[]
      : connectionType !== "REDIS"
      ? [
          { label: "New Table", onClick: () => onAction("new_table"), icon: React.createElement(Plus, { className: "h-4 w-4" }) },
          { separator: true },
          { label: "Export Database", onClick: () => onAction("export_database"), icon: React.createElement(Download, { className: "h-4 w-4" }) },
          { separator: true },
        ] as ContextMenuItem[]
      : []),
    { label: "Rename Database", onClick: () => onAction("edit_database"), icon: React.createElement(Edit2, { className: "h-4 w-4" }) },
    { label: "Delete Database", onClick: () => onAction("delete_database"), icon: React.createElement(Trash2, { className: "h-4 w-4 text-red-500" }), danger: true },
    { separator: true },
    refreshItem(onAction),
    ...systemItems,
  ];
}

export function getSchemaMenuItems(callbacks: MenuCallbacks): ContextMenuItem[] {
  const { onAction } = callbacks;
  return [
    { label: "New Query", onClick: () => onAction("new_query"), icon: React.createElement(Terminal, { className: "h-4 w-4" }) },
    { separator: true },
    { label: "New Table", onClick: () => onAction("new_table"), icon: React.createElement(Plus, { className: "h-4 w-4" }) },
    { separator: true },
    refreshItem(onAction),
  ];
}

export function getTableMenuItems(callbacks: MenuCallbacks): ContextMenuItem[] {
  const { onAction } = callbacks;
  return [
    { label: "Export Data", onClick: () => onAction("export_data"), icon: React.createElement(Download, { className: "h-4 w-4" }) },
    { separator: true },
    { label: "Clear Data", onClick: () => onAction("clear_table_data"), icon: React.createElement(Eraser, { className: "h-4 w-4 text-orange-500" }) },
    { label: "Duplicate Table", onClick: () => onAction("copy_table"), icon: React.createElement(Copy, { className: "h-4 w-4 text-blue-500" }) },
    { separator: true },
    { label: "Design Table", onClick: () => onAction("edit_table"), icon: React.createElement(Edit2, { className: "h-4 w-4" }) },
    { label: "Rename Table", onClick: () => onAction("rename_table"), icon: React.createElement(Edit2, { className: "h-4 w-4 text-blue-500" }) },
    { label: "Delete Table", onClick: () => onAction("delete_table"), icon: React.createElement(Trash2, { className: "h-4 w-4 text-red-500" }), danger: true },
    { separator: true },
    refreshItem(onAction),
  ];
}

export function getViewMenuItems(callbacks: MenuCallbacks): ContextMenuItem[] {
  const { onAction } = callbacks;
  return [
    { label: "Export Data", onClick: () => onAction("export_data"), icon: React.createElement(Download, { className: "h-4 w-4" }) },
    { separator: true },
    refreshItem(onAction),
  ];
}

export function getCollectionMenuItems(callbacks: MenuCallbacks): ContextMenuItem[] {
  const { onAction } = callbacks;
  return [
    { label: "Export Collection", onClick: () => onAction("export_collection"), icon: React.createElement(Download, { className: "h-4 w-4" }) },
    { separator: true },
    { label: "Drop Collection", onClick: () => onAction("drop_collection"), icon: React.createElement(Trash2, { className: "h-4 w-4 text-red-500" }), danger: true },
    { separator: true },
    refreshItem(onAction),
  ];
}
