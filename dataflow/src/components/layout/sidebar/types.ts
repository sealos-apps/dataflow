import type { Connection } from "@/stores/useConnectionStore";

export type NodeType =
  | "connection"
  | "database"
  | "schema"
  | "table"
  | "collection"
  | "redis_keys_list";

export interface TreeNodeData {
  id: string;
  name: string;
  type: NodeType;
  parentId?: string;
  connectionId: string;
  metadata: {
    database?: string;
    schema?: string;
    table?: string;
  };
}

/** Types that can be expanded to show children */
export const EXPANDABLE_TYPES: ReadonlySet<NodeType> = new Set([
  "connection",
  "database",
  "schema",
]);

/** Icon color class per node type */
export const NODE_ICON_COLORS: Record<NodeType, string> = {
  connection: "text-blue-500/80",
  database: "text-purple-500/80",
  schema: "text-orange-500/80",
  table: "text-emerald-500/80",
  collection: "text-green-500/80",
  redis_keys_list: "text-blue-500/80",
};

/** Database brand icons (connection-level, keyed by Connection.type) */
export const DB_ICONS: Record<string, string> = {
  MYSQL: "/images/mysql.svg",
  POSTGRES: "/images/postgresql.svg",
  MONGODB: "/images/mongodb.svg",
  REDIS: "/images/redis.svg",
  // ClickHouse has no brand icon — falls through to default Database icon
};

/** Convert a Connection to a root-level TreeNodeData */
export function connectionToNode(conn: Connection): TreeNodeData {
  return {
    id: conn.id,
    name: conn.name,
    type: "connection",
    connectionId: conn.id,
    metadata: {},
  };
}
