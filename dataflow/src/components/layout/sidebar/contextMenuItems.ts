import React from "react";
import {
  Terminal, Plus, Upload, Download, Edit2, Trash2, Unplug,
  RefreshCw, Eraser, Copy,
} from "lucide-react";
import type { ContextMenuItem } from "@/components/ui/ContextMenu";

type ConnectionType = "MYSQL" | "POSTGRES" | "MONGODB" | "REDIS" | "CLICKHOUSE";

interface MenuCallbacks {
  onAction: (action: string) => void;
}

function refreshItem(onAction: (action: string) => void): ContextMenuItem {
  return { label: "Refresh", onClick: () => onAction("refresh"), icon: React.createElement(RefreshCw, { className: "h-4 w-4" }) };
}

export function getConnectionMenuItems(
  connectionType: ConnectionType,
  callbacks: MenuCallbacks
): ContextMenuItem[] {
  const { onAction } = callbacks;
  return [
    { label: "New Query", onClick: () => onAction("new_query"), icon: React.createElement(Terminal, { className: "h-4 w-4" }) },
    { separator: true },
    ...(connectionType !== "REDIS"
      ? [
          { label: "New Database", onClick: () => onAction("new_database"), icon: React.createElement(Plus, { className: "h-4 w-4" }) },
          { label: "Import Database", onClick: () => onAction("import_database"), icon: React.createElement(Upload, { className: "h-4 w-4" }) },
        ] as ContextMenuItem[]
      : []),
    { separator: true },
    { label: "Edit Connection", onClick: () => onAction("edit_connection"), icon: React.createElement(Edit2, { className: "h-4 w-4" }) },
    { label: "Delete Connection", onClick: () => onAction("delete_connection"), icon: React.createElement(Trash2, { className: "h-4 w-4 text-red-500" }), danger: true },
    { separator: true },
    { label: "Close Connection", onClick: () => onAction("disconnect"), icon: React.createElement(Unplug, { className: "h-4 w-4" }) },
    { separator: true },
    refreshItem(onAction),
  ];
}

export function getDatabaseMenuItems(
  connectionType: ConnectionType,
  callbacks: MenuCallbacks
): ContextMenuItem[] {
  const { onAction } = callbacks;
  return [
    { label: "New Query", onClick: () => onAction("new_query"), icon: React.createElement(Terminal, { className: "h-4 w-4" }) },
    { separator: true },
    ...(connectionType !== "REDIS"
      ? [
          { label: "New Table", onClick: () => onAction("new_table"), icon: React.createElement(Plus, { className: "h-4 w-4" }) },
          { label: "Import Data", onClick: () => onAction("import_data"), icon: React.createElement(Upload, { className: "h-4 w-4" }) },
          { separator: true },
          { label: "Export Database", onClick: () => onAction("export_database"), icon: React.createElement(Download, { className: "h-4 w-4" }) },
          { separator: true },
        ] as ContextMenuItem[]
      : []),
    { label: "Edit Database", onClick: () => onAction("edit_database"), icon: React.createElement(Edit2, { className: "h-4 w-4" }) },
    { label: "Delete Database", onClick: () => onAction("delete_database"), icon: React.createElement(Trash2, { className: "h-4 w-4 text-red-500" }), danger: true },
    { separator: true },
    refreshItem(onAction),
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
    { label: "Import Data", onClick: () => onAction("import_data"), icon: React.createElement(Upload, { className: "h-4 w-4" }) },
    { label: "Export Data", onClick: () => onAction("export_data"), icon: React.createElement(Download, { className: "h-4 w-4" }) },
    { separator: true },
    { label: "Clear Data", onClick: () => onAction("truncate_table"), icon: React.createElement(Eraser, { className: "h-4 w-4 text-orange-500" }) },
    { label: "Duplicate Table", onClick: () => onAction("copy_table"), icon: React.createElement(Copy, { className: "h-4 w-4 text-blue-500" }) },
    { separator: true },
    { label: "Design Table", onClick: () => onAction("edit_table"), icon: React.createElement(Edit2, { className: "h-4 w-4" }) },
    { label: "Delete Table", onClick: () => onAction("delete_table"), icon: React.createElement(Trash2, { className: "h-4 w-4 text-red-500" }), danger: true },
    { separator: true },
    refreshItem(onAction),
  ];
}

export function getCollectionMenuItems(callbacks: MenuCallbacks): ContextMenuItem[] {
  const { onAction } = callbacks;
  return [
    { label: "Export Collection", onClick: () => onAction("export_collection"), icon: React.createElement(Download, { className: "h-4 w-4" }) },
    { label: "Import Collection", onClick: () => onAction("import_collection"), icon: React.createElement(Upload, { className: "h-4 w-4" }) },
    { separator: true },
    { label: "Drop Collection", onClick: () => onAction("drop_collection"), icon: React.createElement(Trash2, { className: "h-4 w-4 text-red-500" }), danger: true },
    { separator: true },
    refreshItem(onAction),
  ];
}
