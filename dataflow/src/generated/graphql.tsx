import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  Upload: { input: any; output: any; }
};

export type AiChatMessage = {
  __typename?: 'AIChatMessage';
  RequiresConfirmation: Scalars['Boolean']['output'];
  Result?: Maybe<RowsResult>;
  Text: Scalars['String']['output'];
  Type: Scalars['String']['output'];
};

export type AiProvider = {
  __typename?: 'AIProvider';
  IsEnvironmentDefined: Scalars['Boolean']['output'];
  IsGeneric: Scalars['Boolean']['output'];
  Name: Scalars['String']['output'];
  ProviderId: Scalars['String']['output'];
  Type: Scalars['String']['output'];
};

export type AwsProvider = CloudProvider & {
  __typename?: 'AWSProvider';
  DiscoverDocumentDB: Scalars['Boolean']['output'];
  DiscoverElastiCache: Scalars['Boolean']['output'];
  DiscoverRDS: Scalars['Boolean']['output'];
  DiscoveredCount: Scalars['Int']['output'];
  Error?: Maybe<Scalars['String']['output']>;
  Id: Scalars['ID']['output'];
  LastDiscoveryAt?: Maybe<Scalars['String']['output']>;
  Name: Scalars['String']['output'];
  ProfileName?: Maybe<Scalars['String']['output']>;
  ProviderType: CloudProviderType;
  Region: Scalars['String']['output'];
  Status: CloudProviderStatus;
};

export type AwsProviderInput = {
  DiscoverDocumentDB?: InputMaybe<Scalars['Boolean']['input']>;
  DiscoverElastiCache?: InputMaybe<Scalars['Boolean']['input']>;
  DiscoverRDS?: InputMaybe<Scalars['Boolean']['input']>;
  Name: Scalars['String']['input'];
  ProfileName?: InputMaybe<Scalars['String']['input']>;
  Region: Scalars['String']['input'];
};

export type AwsRegion = {
  __typename?: 'AWSRegion';
  Description: Scalars['String']['output'];
  Id: Scalars['String']['output'];
  Partition: Scalars['String']['output'];
};

export type AtomicWhereCondition = {
  ColumnType: Scalars['String']['input'];
  Key: Scalars['String']['input'];
  Operator: Scalars['String']['input'];
  Value: Scalars['String']['input'];
};

export type Capabilities = {
  __typename?: 'Capabilities';
  supportsChat: Scalars['Boolean']['output'];
  supportsDatabaseSwitch: Scalars['Boolean']['output'];
  supportsGraph: Scalars['Boolean']['output'];
  supportsModifiers: Scalars['Boolean']['output'];
  supportsSchema: Scalars['Boolean']['output'];
  supportsScratchpad: Scalars['Boolean']['output'];
};

export type ChatInput = {
  Model: Scalars['String']['input'];
  PreviousConversation: Scalars['String']['input'];
  Query: Scalars['String']['input'];
  Token?: InputMaybe<Scalars['String']['input']>;
};

export type CloudProvider = {
  DiscoveredCount: Scalars['Int']['output'];
  Error?: Maybe<Scalars['String']['output']>;
  Id: Scalars['ID']['output'];
  LastDiscoveryAt?: Maybe<Scalars['String']['output']>;
  Name: Scalars['String']['output'];
  ProviderType: CloudProviderType;
  Region: Scalars['String']['output'];
  Status: CloudProviderStatus;
};

export enum CloudProviderStatus {
  Connected = 'Connected',
  Disconnected = 'Disconnected',
  Discovering = 'Discovering',
  Error = 'Error'
}

export enum CloudProviderType {
  Aws = 'AWS'
}

export type Column = {
  __typename?: 'Column';
  IsForeignKey: Scalars['Boolean']['output'];
  IsPrimary: Scalars['Boolean']['output'];
  Length?: Maybe<Scalars['Int']['output']>;
  Name: Scalars['String']['output'];
  Precision?: Maybe<Scalars['Int']['output']>;
  ReferencedColumn?: Maybe<Scalars['String']['output']>;
  ReferencedTable?: Maybe<Scalars['String']['output']>;
  Scale?: Maybe<Scalars['Int']['output']>;
  Type: Scalars['String']['output'];
};

export enum ConnectionStatus {
  Available = 'Available',
  Deleting = 'Deleting',
  Failed = 'Failed',
  Starting = 'Starting',
  Stopped = 'Stopped',
  Unknown = 'Unknown'
}

export type DatabaseMetadata = {
  __typename?: 'DatabaseMetadata';
  aliasMap: Array<Record>;
  capabilities: Capabilities;
  databaseType: Scalars['String']['output'];
  operators: Array<Scalars['String']['output']>;
  systemSchemas: Array<Scalars['String']['output']>;
  typeDefinitions: Array<TypeDefinition>;
};

export type DatabaseQuerySuggestion = {
  __typename?: 'DatabaseQuerySuggestion';
  category: Scalars['String']['output'];
  description: Scalars['String']['output'];
};

export enum DatabaseType {
  ClickHouse = 'ClickHouse',
  ElasticSearch = 'ElasticSearch',
  MariaDb = 'MariaDB',
  MongoDb = 'MongoDB',
  MySql = 'MySQL',
  Postgres = 'Postgres',
  Redis = 'Redis',
  Sqlite3 = 'Sqlite3'
}

export type DiscoveredConnection = {
  __typename?: 'DiscoveredConnection';
  DatabaseType: Scalars['String']['output'];
  Id: Scalars['ID']['output'];
  Metadata: Array<Record>;
  Name: Scalars['String']['output'];
  ProviderID: Scalars['String']['output'];
  ProviderType: CloudProviderType;
  Region?: Maybe<Scalars['String']['output']>;
  Status: ConnectionStatus;
};

export type GenerateChatTitleInput = {
  Endpoint?: InputMaybe<Scalars['String']['input']>;
  Model: Scalars['String']['input'];
  ModelType: Scalars['String']['input'];
  ProviderId?: InputMaybe<Scalars['String']['input']>;
  Query: Scalars['String']['input'];
  Token?: InputMaybe<Scalars['String']['input']>;
};

export type GenerateChatTitleResponse = {
  __typename?: 'GenerateChatTitleResponse';
  Title: Scalars['String']['output'];
};

export type GraphUnit = {
  __typename?: 'GraphUnit';
  Relations: Array<GraphUnitRelationship>;
  Unit: StorageUnit;
};

export type GraphUnitRelationship = {
  __typename?: 'GraphUnitRelationship';
  Name: Scalars['String']['output'];
  Relationship: GraphUnitRelationshipType;
  SourceColumn?: Maybe<Scalars['String']['output']>;
  TargetColumn?: Maybe<Scalars['String']['output']>;
};

export enum GraphUnitRelationshipType {
  ManyToMany = 'ManyToMany',
  ManyToOne = 'ManyToOne',
  OneToMany = 'OneToMany',
  OneToOne = 'OneToOne',
  Unknown = 'Unknown'
}

export type HealthStatus = {
  __typename?: 'HealthStatus';
  Database: Scalars['String']['output'];
  Server: Scalars['String']['output'];
};

export type ImportColumnMapping = {
  Skip: Scalars['Boolean']['input'];
  SourceColumn: Scalars['String']['input'];
  TargetColumn?: InputMaybe<Scalars['String']['input']>;
};

export type ImportColumnMappingPreview = {
  __typename?: 'ImportColumnMappingPreview';
  SourceColumn: Scalars['String']['output'];
  TargetColumn: Scalars['String']['output'];
};

export enum ImportFileFormat {
  Csv = 'CSV',
  Excel = 'EXCEL'
}

export type ImportFileInput = {
  AllowAutoGenerated?: InputMaybe<Scalars['Boolean']['input']>;
  File: Scalars['Upload']['input'];
  Mapping: Array<ImportColumnMapping>;
  Mode: ImportMode;
  Options: ImportFileOptions;
  Schema: Scalars['String']['input'];
  StorageUnit: Scalars['String']['input'];
};

export type ImportFileOptions = {
  Delimiter?: InputMaybe<Scalars['String']['input']>;
  Format: ImportFileFormat;
  Sheet?: InputMaybe<Scalars['String']['input']>;
};

export enum ImportMode {
  Append = 'APPEND',
  Overwrite = 'OVERWRITE',
  Upsert = 'UPSERT'
}

export type ImportPreview = {
  __typename?: 'ImportPreview';
  AutoGeneratedColumns: Array<Scalars['String']['output']>;
  Columns: Array<Scalars['String']['output']>;
  Mapping?: Maybe<Array<ImportColumnMappingPreview>>;
  RequiresAllowAutoGenerated: Scalars['Boolean']['output'];
  Rows: Array<Array<Scalars['String']['output']>>;
  Sheet?: Maybe<Scalars['String']['output']>;
  Truncated: Scalars['Boolean']['output'];
  ValidationError?: Maybe<Scalars['String']['output']>;
};

export type ImportResult = {
  __typename?: 'ImportResult';
  Detail?: Maybe<Scalars['String']['output']>;
  Message: Scalars['String']['output'];
  Status: Scalars['Boolean']['output'];
};

export type ImportSqlInput = {
  File?: InputMaybe<Scalars['Upload']['input']>;
  Filename?: InputMaybe<Scalars['String']['input']>;
  Script?: InputMaybe<Scalars['String']['input']>;
};

export type LocalAwsProfile = {
  __typename?: 'LocalAWSProfile';
  AuthType: Scalars['String']['output'];
  IsDefault: Scalars['Boolean']['output'];
  Name: Scalars['String']['output'];
  Region?: Maybe<Scalars['String']['output']>;
  Source: Scalars['String']['output'];
};

export type LoginCredentials = {
  Advanced?: InputMaybe<Array<RecordInput>>;
  Database: Scalars['String']['input'];
  Hostname: Scalars['String']['input'];
  Id?: InputMaybe<Scalars['String']['input']>;
  Password: Scalars['String']['input'];
  Type: Scalars['String']['input'];
  Username: Scalars['String']['input'];
};

export type LoginProfile = {
  __typename?: 'LoginProfile';
  Alias?: Maybe<Scalars['String']['output']>;
  Database?: Maybe<Scalars['String']['output']>;
  Hostname?: Maybe<Scalars['String']['output']>;
  Id: Scalars['String']['output'];
  IsEnvironmentDefined: Scalars['Boolean']['output'];
  SSLConfigured: Scalars['Boolean']['output'];
  Source: Scalars['String']['output'];
  Type: DatabaseType;
};

export type LoginProfileInput = {
  Database?: InputMaybe<Scalars['String']['input']>;
  Id: Scalars['String']['input'];
  Type: DatabaseType;
};

export type MockDataDependencyAnalysis = {
  __typename?: 'MockDataDependencyAnalysis';
  Error?: Maybe<Scalars['String']['output']>;
  GenerationOrder: Array<Scalars['String']['output']>;
  Tables: Array<MockDataTableInfo>;
  TotalRows: Scalars['Int']['output'];
  Warnings: Array<Scalars['String']['output']>;
};

export type MockDataGenerationInput = {
  FkDensityRatio?: InputMaybe<Scalars['Int']['input']>;
  Method: Scalars['String']['input'];
  OverwriteExisting: Scalars['Boolean']['input'];
  RowCount: Scalars['Int']['input'];
  Schema: Scalars['String']['input'];
  StorageUnit: Scalars['String']['input'];
};

export type MockDataGenerationStatus = {
  __typename?: 'MockDataGenerationStatus';
  AmountGenerated: Scalars['Int']['output'];
  Details?: Maybe<Array<MockDataTableDetail>>;
};

export type MockDataTableDetail = {
  __typename?: 'MockDataTableDetail';
  RowsGenerated: Scalars['Int']['output'];
  Table: Scalars['String']['output'];
  UsedExistingData: Scalars['Boolean']['output'];
};

export type MockDataTableInfo = {
  __typename?: 'MockDataTableInfo';
  IsBlocked: Scalars['Boolean']['output'];
  RowsToGenerate: Scalars['Int']['output'];
  Table: Scalars['String']['output'];
  UsesExistingData: Scalars['Boolean']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  AddAWSProvider: AwsProvider;
  AddRow: StatusResponse;
  AddStorageUnit: StatusResponse;
  DeleteRow: StatusResponse;
  ExecuteConfirmedSQL: AiChatMessage;
  GenerateChatTitle: GenerateChatTitleResponse;
  GenerateMockData: MockDataGenerationStatus;
  GenerateRDSAuthToken: Scalars['String']['output'];
  ImportPreview: ImportPreview;
  ImportSQL: ImportResult;
  ImportTableFile: ImportResult;
  Login: StatusResponse;
  LoginWithProfile: StatusResponse;
  Logout: StatusResponse;
  RefreshCloudProvider: AwsProvider;
  RemoveCloudProvider: StatusResponse;
  TestAWSCredentials: CloudProviderStatus;
  TestCloudProvider: CloudProviderStatus;
  UpdateAWSProvider: AwsProvider;
  UpdateSettings: StatusResponse;
  UpdateStorageUnit: StatusResponse;
};


export type MutationAddAwsProviderArgs = {
  input: AwsProviderInput;
};


export type MutationAddRowArgs = {
  schema: Scalars['String']['input'];
  storageUnit: Scalars['String']['input'];
  values: Array<RecordInput>;
};


export type MutationAddStorageUnitArgs = {
  fields: Array<RecordInput>;
  schema: Scalars['String']['input'];
  storageUnit: Scalars['String']['input'];
};


export type MutationDeleteRowArgs = {
  schema: Scalars['String']['input'];
  storageUnit: Scalars['String']['input'];
  values: Array<RecordInput>;
};


export type MutationExecuteConfirmedSqlArgs = {
  operationType: Scalars['String']['input'];
  query: Scalars['String']['input'];
};


export type MutationGenerateChatTitleArgs = {
  input: GenerateChatTitleInput;
};


export type MutationGenerateMockDataArgs = {
  input: MockDataGenerationInput;
};


export type MutationGenerateRdsAuthTokenArgs = {
  endpoint: Scalars['String']['input'];
  port: Scalars['Int']['input'];
  providerID: Scalars['ID']['input'];
  region: Scalars['String']['input'];
  username: Scalars['String']['input'];
};


export type MutationImportPreviewArgs = {
  file: Scalars['Upload']['input'];
  options: ImportFileOptions;
  schema?: InputMaybe<Scalars['String']['input']>;
  storageUnit?: InputMaybe<Scalars['String']['input']>;
  useHeaderMapping?: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationImportSqlArgs = {
  input: ImportSqlInput;
};


export type MutationImportTableFileArgs = {
  input: ImportFileInput;
};


export type MutationLoginArgs = {
  credentials: LoginCredentials;
};


export type MutationLoginWithProfileArgs = {
  profile: LoginProfileInput;
};


export type MutationRefreshCloudProviderArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRemoveCloudProviderArgs = {
  id: Scalars['ID']['input'];
};


export type MutationTestAwsCredentialsArgs = {
  input: AwsProviderInput;
};


export type MutationTestCloudProviderArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUpdateAwsProviderArgs = {
  id: Scalars['ID']['input'];
  input: AwsProviderInput;
};


export type MutationUpdateSettingsArgs = {
  newSettings: SettingsConfigInput;
};


export type MutationUpdateStorageUnitArgs = {
  schema: Scalars['String']['input'];
  storageUnit: Scalars['String']['input'];
  updatedColumns: Array<Scalars['String']['input']>;
  values: Array<RecordInput>;
};

export type OperationWhereCondition = {
  Children: Array<WhereCondition>;
};

export type Query = {
  __typename?: 'Query';
  AIChat: Array<AiChatMessage>;
  AIModel: Array<Scalars['String']['output']>;
  AIProviders: Array<AiProvider>;
  AWSRegions: Array<AwsRegion>;
  AnalyzeMockDataDependencies: MockDataDependencyAnalysis;
  CloudProvider?: Maybe<AwsProvider>;
  CloudProviders: Array<AwsProvider>;
  Columns: Array<Column>;
  ColumnsBatch: Array<StorageUnitColumns>;
  Database: Array<Scalars['String']['output']>;
  DatabaseMetadata?: Maybe<DatabaseMetadata>;
  DatabaseQuerySuggestions: Array<DatabaseQuerySuggestion>;
  DiscoveredConnections: Array<DiscoveredConnection>;
  Graph: Array<GraphUnit>;
  Health: HealthStatus;
  LocalAWSProfiles: Array<LocalAwsProfile>;
  MockDataMaxRowCount: Scalars['Int']['output'];
  Profiles: Array<LoginProfile>;
  ProviderConnections: Array<DiscoveredConnection>;
  RawExecute: RowsResult;
  Row: RowsResult;
  SSLStatus?: Maybe<SslStatus>;
  Schema: Array<Scalars['String']['output']>;
  SettingsConfig: SettingsConfig;
  StorageUnit: Array<StorageUnit>;
  UpdateInfo: UpdateInfo;
  Version: Scalars['String']['output'];
};


export type QueryAiChatArgs = {
  input: ChatInput;
  modelType: Scalars['String']['input'];
  providerId?: InputMaybe<Scalars['String']['input']>;
  schema: Scalars['String']['input'];
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryAiModelArgs = {
  modelType: Scalars['String']['input'];
  providerId?: InputMaybe<Scalars['String']['input']>;
  token?: InputMaybe<Scalars['String']['input']>;
};


export type QueryAnalyzeMockDataDependenciesArgs = {
  fkDensityRatio?: InputMaybe<Scalars['Int']['input']>;
  rowCount: Scalars['Int']['input'];
  schema: Scalars['String']['input'];
  storageUnit: Scalars['String']['input'];
};


export type QueryCloudProviderArgs = {
  id: Scalars['ID']['input'];
};


export type QueryColumnsArgs = {
  schema: Scalars['String']['input'];
  storageUnit: Scalars['String']['input'];
};


export type QueryColumnsBatchArgs = {
  schema: Scalars['String']['input'];
  storageUnits: Array<Scalars['String']['input']>;
};


export type QueryDatabaseArgs = {
  type: Scalars['String']['input'];
};


export type QueryDatabaseQuerySuggestionsArgs = {
  schema: Scalars['String']['input'];
};


export type QueryGraphArgs = {
  schema: Scalars['String']['input'];
};


export type QueryProviderConnectionsArgs = {
  providerID: Scalars['ID']['input'];
};


export type QueryRawExecuteArgs = {
  query: Scalars['String']['input'];
};


export type QueryRowArgs = {
  pageOffset: Scalars['Int']['input'];
  pageSize: Scalars['Int']['input'];
  schema: Scalars['String']['input'];
  sort?: InputMaybe<Array<SortCondition>>;
  storageUnit: Scalars['String']['input'];
  where?: InputMaybe<WhereCondition>;
};


export type QueryStorageUnitArgs = {
  schema: Scalars['String']['input'];
};

export type Record = {
  __typename?: 'Record';
  Key: Scalars['String']['output'];
  Value: Scalars['String']['output'];
};

export type RecordInput = {
  Extra?: InputMaybe<Array<RecordInput>>;
  Key: Scalars['String']['input'];
  Value: Scalars['String']['input'];
};

export type RowsResult = {
  __typename?: 'RowsResult';
  Columns: Array<Column>;
  DisableUpdate: Scalars['Boolean']['output'];
  Rows: Array<Array<Scalars['String']['output']>>;
  TotalCount: Scalars['Int']['output'];
};

export type SslStatus = {
  __typename?: 'SSLStatus';
  IsEnabled: Scalars['Boolean']['output'];
  Mode: Scalars['String']['output'];
};

export type SettingsConfig = {
  __typename?: 'SettingsConfig';
  CloudProvidersEnabled: Scalars['Boolean']['output'];
  DisableCredentialForm: Scalars['Boolean']['output'];
  MaxPageSize: Scalars['Int']['output'];
  MetricsEnabled?: Maybe<Scalars['Boolean']['output']>;
};

export type SettingsConfigInput = {
  MetricsEnabled?: InputMaybe<Scalars['String']['input']>;
};

export type SortCondition = {
  Column: Scalars['String']['input'];
  Direction: SortDirection;
};

export enum SortDirection {
  Asc = 'ASC',
  Desc = 'DESC'
}

export type StatusResponse = {
  __typename?: 'StatusResponse';
  Status: Scalars['Boolean']['output'];
};

export type StorageUnit = {
  __typename?: 'StorageUnit';
  Attributes: Array<Record>;
  IsMockDataGenerationAllowed: Scalars['Boolean']['output'];
  Name: Scalars['String']['output'];
};

export type StorageUnitColumns = {
  __typename?: 'StorageUnitColumns';
  Columns: Array<Column>;
  StorageUnit: Scalars['String']['output'];
};

export enum TypeCategory {
  Binary = 'binary',
  Boolean = 'boolean',
  Datetime = 'datetime',
  Json = 'json',
  Numeric = 'numeric',
  Other = 'other',
  Text = 'text'
}

export type TypeDefinition = {
  __typename?: 'TypeDefinition';
  category: TypeCategory;
  defaultLength?: Maybe<Scalars['Int']['output']>;
  defaultPrecision?: Maybe<Scalars['Int']['output']>;
  hasLength: Scalars['Boolean']['output'];
  hasPrecision: Scalars['Boolean']['output'];
  id: Scalars['String']['output'];
  label: Scalars['String']['output'];
};

export type UpdateInfo = {
  __typename?: 'UpdateInfo';
  currentVersion: Scalars['String']['output'];
  latestVersion: Scalars['String']['output'];
  releaseURL: Scalars['String']['output'];
  updateAvailable: Scalars['Boolean']['output'];
};

export type WhereCondition = {
  And?: InputMaybe<OperationWhereCondition>;
  Atomic?: InputMaybe<AtomicWhereCondition>;
  Or?: InputMaybe<OperationWhereCondition>;
  Type: WhereConditionType;
};

export enum WhereConditionType {
  And = 'And',
  Atomic = 'Atomic',
  Or = 'Or'
}

export type AddRowMutationVariables = Exact<{
  schema: Scalars['String']['input'];
  storageUnit: Scalars['String']['input'];
  values: Array<RecordInput> | RecordInput;
}>;


export type AddRowMutation = { __typename?: 'Mutation', AddRow: { __typename?: 'StatusResponse', Status: boolean } };

export type AddStorageUnitMutationVariables = Exact<{
  schema: Scalars['String']['input'];
  storageUnit: Scalars['String']['input'];
  fields: Array<RecordInput> | RecordInput;
}>;


export type AddStorageUnitMutation = { __typename?: 'Mutation', AddStorageUnit: { __typename?: 'StatusResponse', Status: boolean } };

export type DeleteRowMutationVariables = Exact<{
  schema: Scalars['String']['input'];
  storageUnit: Scalars['String']['input'];
  values: Array<RecordInput> | RecordInput;
}>;


export type DeleteRowMutation = { __typename?: 'Mutation', DeleteRow: { __typename?: 'StatusResponse', Status: boolean } };

export type ExecuteConfirmedSqlMutationVariables = Exact<{
  query: Scalars['String']['input'];
  operationType: Scalars['String']['input'];
}>;


export type ExecuteConfirmedSqlMutation = { __typename?: 'Mutation', ExecuteConfirmedSQL: { __typename?: 'AIChatMessage', Type: string, Text: string, RequiresConfirmation: boolean, Result?: { __typename?: 'RowsResult', Rows: Array<Array<string>>, TotalCount: number, Columns: Array<{ __typename?: 'Column', Type: string, Name: string }> } | null } };

export type LoginMutationVariables = Exact<{
  credentials: LoginCredentials;
}>;


export type LoginMutation = { __typename?: 'Mutation', Login: { __typename?: 'StatusResponse', Status: boolean } };

export type UpdateStorageUnitMutationVariables = Exact<{
  schema: Scalars['String']['input'];
  storageUnit: Scalars['String']['input'];
  values: Array<RecordInput> | RecordInput;
  updatedColumns: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;


export type UpdateStorageUnitMutation = { __typename?: 'Mutation', UpdateStorageUnit: { __typename?: 'StatusResponse', Status: boolean } };

export type GetColumnsBatchQueryVariables = Exact<{
  schema: Scalars['String']['input'];
  storageUnits: Array<Scalars['String']['input']> | Scalars['String']['input'];
}>;


export type GetColumnsBatchQuery = { __typename?: 'Query', ColumnsBatch: Array<{ __typename?: 'StorageUnitColumns', StorageUnit: string, Columns: Array<{ __typename?: 'Column', Type: string, Name: string, IsPrimary: boolean, IsForeignKey: boolean, ReferencedTable?: string | null, ReferencedColumn?: string | null, Length?: number | null, Precision?: number | null, Scale?: number | null }> }> };

export type GetColumnsQueryVariables = Exact<{
  schema: Scalars['String']['input'];
  storageUnit: Scalars['String']['input'];
}>;


export type GetColumnsQuery = { __typename?: 'Query', Columns: Array<{ __typename?: 'Column', Type: string, Name: string, IsPrimary: boolean, IsForeignKey: boolean, ReferencedTable?: string | null, ReferencedColumn?: string | null, Length?: number | null, Precision?: number | null, Scale?: number | null }> };

export type GetDatabaseMetadataQueryVariables = Exact<{ [key: string]: never; }>;


export type GetDatabaseMetadataQuery = { __typename?: 'Query', DatabaseMetadata?: { __typename?: 'DatabaseMetadata', databaseType: string, operators: Array<string>, systemSchemas: Array<string>, typeDefinitions: Array<{ __typename?: 'TypeDefinition', id: string, label: string, hasLength: boolean, hasPrecision: boolean, defaultLength?: number | null, defaultPrecision?: number | null, category: TypeCategory }>, aliasMap: Array<{ __typename?: 'Record', Key: string, Value: string }>, capabilities: { __typename?: 'Capabilities', supportsScratchpad: boolean, supportsChat: boolean, supportsGraph: boolean, supportsSchema: boolean, supportsDatabaseSwitch: boolean, supportsModifiers: boolean } } | null };

export type GetDatabaseQueryVariables = Exact<{
  type: Scalars['String']['input'];
}>;


export type GetDatabaseQuery = { __typename?: 'Query', Database: Array<string> };

export type RawExecuteQueryVariables = Exact<{
  query: Scalars['String']['input'];
}>;


export type RawExecuteQuery = { __typename?: 'Query', RawExecute: { __typename?: 'RowsResult', Rows: Array<Array<string>>, TotalCount: number, Columns: Array<{ __typename?: 'Column', Type: string, Name: string }> } };

export type GetStorageUnitRowsQueryVariables = Exact<{
  schema: Scalars['String']['input'];
  storageUnit: Scalars['String']['input'];
  where?: InputMaybe<WhereCondition>;
  sort?: InputMaybe<Array<SortCondition> | SortCondition>;
  pageSize: Scalars['Int']['input'];
  pageOffset: Scalars['Int']['input'];
}>;


export type GetStorageUnitRowsQuery = { __typename?: 'Query', Row: { __typename?: 'RowsResult', Rows: Array<Array<string>>, DisableUpdate: boolean, TotalCount: number, Columns: Array<{ __typename?: 'Column', Type: string, Name: string, IsPrimary: boolean, IsForeignKey: boolean, ReferencedTable?: string | null, ReferencedColumn?: string | null, Length?: number | null, Precision?: number | null, Scale?: number | null }> } };

export type GetSchemaQueryVariables = Exact<{ [key: string]: never; }>;


export type GetSchemaQuery = { __typename?: 'Query', Schema: Array<string> };

export type GetStorageUnitsQueryVariables = Exact<{
  schema: Scalars['String']['input'];
}>;


export type GetStorageUnitsQuery = { __typename?: 'Query', StorageUnit: Array<{ __typename?: 'StorageUnit', Name: string, Attributes: Array<{ __typename?: 'Record', Key: string, Value: string }> }> };


export const AddRowDocument = gql`
    mutation AddRow($schema: String!, $storageUnit: String!, $values: [RecordInput!]!) {
  AddRow(schema: $schema, storageUnit: $storageUnit, values: $values) {
    Status
  }
}
    `;
export type AddRowMutationFn = Apollo.MutationFunction<AddRowMutation, AddRowMutationVariables>;

/**
 * __useAddRowMutation__
 *
 * To run a mutation, you first call `useAddRowMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAddRowMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [addRowMutation, { data, loading, error }] = useAddRowMutation({
 *   variables: {
 *      schema: // value for 'schema'
 *      storageUnit: // value for 'storageUnit'
 *      values: // value for 'values'
 *   },
 * });
 */
export function useAddRowMutation(baseOptions?: Apollo.MutationHookOptions<AddRowMutation, AddRowMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<AddRowMutation, AddRowMutationVariables>(AddRowDocument, options);
      }
export type AddRowMutationHookResult = ReturnType<typeof useAddRowMutation>;
export type AddRowMutationResult = Apollo.MutationResult<AddRowMutation>;
export type AddRowMutationOptions = Apollo.BaseMutationOptions<AddRowMutation, AddRowMutationVariables>;
export const AddStorageUnitDocument = gql`
    mutation AddStorageUnit($schema: String!, $storageUnit: String!, $fields: [RecordInput!]!) {
  AddStorageUnit(schema: $schema, storageUnit: $storageUnit, fields: $fields) {
    Status
  }
}
    `;
export type AddStorageUnitMutationFn = Apollo.MutationFunction<AddStorageUnitMutation, AddStorageUnitMutationVariables>;

/**
 * __useAddStorageUnitMutation__
 *
 * To run a mutation, you first call `useAddStorageUnitMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAddStorageUnitMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [addStorageUnitMutation, { data, loading, error }] = useAddStorageUnitMutation({
 *   variables: {
 *      schema: // value for 'schema'
 *      storageUnit: // value for 'storageUnit'
 *      fields: // value for 'fields'
 *   },
 * });
 */
export function useAddStorageUnitMutation(baseOptions?: Apollo.MutationHookOptions<AddStorageUnitMutation, AddStorageUnitMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<AddStorageUnitMutation, AddStorageUnitMutationVariables>(AddStorageUnitDocument, options);
      }
export type AddStorageUnitMutationHookResult = ReturnType<typeof useAddStorageUnitMutation>;
export type AddStorageUnitMutationResult = Apollo.MutationResult<AddStorageUnitMutation>;
export type AddStorageUnitMutationOptions = Apollo.BaseMutationOptions<AddStorageUnitMutation, AddStorageUnitMutationVariables>;
export const DeleteRowDocument = gql`
    mutation DeleteRow($schema: String!, $storageUnit: String!, $values: [RecordInput!]!) {
  DeleteRow(schema: $schema, storageUnit: $storageUnit, values: $values) {
    Status
  }
}
    `;
export type DeleteRowMutationFn = Apollo.MutationFunction<DeleteRowMutation, DeleteRowMutationVariables>;

/**
 * __useDeleteRowMutation__
 *
 * To run a mutation, you first call `useDeleteRowMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteRowMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteRowMutation, { data, loading, error }] = useDeleteRowMutation({
 *   variables: {
 *      schema: // value for 'schema'
 *      storageUnit: // value for 'storageUnit'
 *      values: // value for 'values'
 *   },
 * });
 */
export function useDeleteRowMutation(baseOptions?: Apollo.MutationHookOptions<DeleteRowMutation, DeleteRowMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteRowMutation, DeleteRowMutationVariables>(DeleteRowDocument, options);
      }
export type DeleteRowMutationHookResult = ReturnType<typeof useDeleteRowMutation>;
export type DeleteRowMutationResult = Apollo.MutationResult<DeleteRowMutation>;
export type DeleteRowMutationOptions = Apollo.BaseMutationOptions<DeleteRowMutation, DeleteRowMutationVariables>;
export const ExecuteConfirmedSqlDocument = gql`
    mutation ExecuteConfirmedSQL($query: String!, $operationType: String!) {
  ExecuteConfirmedSQL(query: $query, operationType: $operationType) {
    Type
    Text
    Result {
      Columns {
        Type
        Name
      }
      Rows
      TotalCount
    }
    RequiresConfirmation
  }
}
    `;
export type ExecuteConfirmedSqlMutationFn = Apollo.MutationFunction<ExecuteConfirmedSqlMutation, ExecuteConfirmedSqlMutationVariables>;

/**
 * __useExecuteConfirmedSqlMutation__
 *
 * To run a mutation, you first call `useExecuteConfirmedSqlMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useExecuteConfirmedSqlMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [executeConfirmedSqlMutation, { data, loading, error }] = useExecuteConfirmedSqlMutation({
 *   variables: {
 *      query: // value for 'query'
 *      operationType: // value for 'operationType'
 *   },
 * });
 */
export function useExecuteConfirmedSqlMutation(baseOptions?: Apollo.MutationHookOptions<ExecuteConfirmedSqlMutation, ExecuteConfirmedSqlMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ExecuteConfirmedSqlMutation, ExecuteConfirmedSqlMutationVariables>(ExecuteConfirmedSqlDocument, options);
      }
export type ExecuteConfirmedSqlMutationHookResult = ReturnType<typeof useExecuteConfirmedSqlMutation>;
export type ExecuteConfirmedSqlMutationResult = Apollo.MutationResult<ExecuteConfirmedSqlMutation>;
export type ExecuteConfirmedSqlMutationOptions = Apollo.BaseMutationOptions<ExecuteConfirmedSqlMutation, ExecuteConfirmedSqlMutationVariables>;
export const LoginDocument = gql`
    mutation Login($credentials: LoginCredentials!) {
  Login(credentials: $credentials) {
    Status
  }
}
    `;
export type LoginMutationFn = Apollo.MutationFunction<LoginMutation, LoginMutationVariables>;

/**
 * __useLoginMutation__
 *
 * To run a mutation, you first call `useLoginMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLoginMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [loginMutation, { data, loading, error }] = useLoginMutation({
 *   variables: {
 *      credentials: // value for 'credentials'
 *   },
 * });
 */
export function useLoginMutation(baseOptions?: Apollo.MutationHookOptions<LoginMutation, LoginMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<LoginMutation, LoginMutationVariables>(LoginDocument, options);
      }
export type LoginMutationHookResult = ReturnType<typeof useLoginMutation>;
export type LoginMutationResult = Apollo.MutationResult<LoginMutation>;
export type LoginMutationOptions = Apollo.BaseMutationOptions<LoginMutation, LoginMutationVariables>;
export const UpdateStorageUnitDocument = gql`
    mutation UpdateStorageUnit($schema: String!, $storageUnit: String!, $values: [RecordInput!]!, $updatedColumns: [String!]!) {
  UpdateStorageUnit(
    schema: $schema
    storageUnit: $storageUnit
    values: $values
    updatedColumns: $updatedColumns
  ) {
    Status
  }
}
    `;
export type UpdateStorageUnitMutationFn = Apollo.MutationFunction<UpdateStorageUnitMutation, UpdateStorageUnitMutationVariables>;

/**
 * __useUpdateStorageUnitMutation__
 *
 * To run a mutation, you first call `useUpdateStorageUnitMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateStorageUnitMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateStorageUnitMutation, { data, loading, error }] = useUpdateStorageUnitMutation({
 *   variables: {
 *      schema: // value for 'schema'
 *      storageUnit: // value for 'storageUnit'
 *      values: // value for 'values'
 *      updatedColumns: // value for 'updatedColumns'
 *   },
 * });
 */
export function useUpdateStorageUnitMutation(baseOptions?: Apollo.MutationHookOptions<UpdateStorageUnitMutation, UpdateStorageUnitMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateStorageUnitMutation, UpdateStorageUnitMutationVariables>(UpdateStorageUnitDocument, options);
      }
export type UpdateStorageUnitMutationHookResult = ReturnType<typeof useUpdateStorageUnitMutation>;
export type UpdateStorageUnitMutationResult = Apollo.MutationResult<UpdateStorageUnitMutation>;
export type UpdateStorageUnitMutationOptions = Apollo.BaseMutationOptions<UpdateStorageUnitMutation, UpdateStorageUnitMutationVariables>;
export const GetColumnsBatchDocument = gql`
    query GetColumnsBatch($schema: String!, $storageUnits: [String!]!) {
  ColumnsBatch(schema: $schema, storageUnits: $storageUnits) {
    StorageUnit
    Columns {
      Type
      Name
      IsPrimary
      IsForeignKey
      ReferencedTable
      ReferencedColumn
      Length
      Precision
      Scale
    }
  }
}
    `;

/**
 * __useGetColumnsBatchQuery__
 *
 * To run a query within a React component, call `useGetColumnsBatchQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetColumnsBatchQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetColumnsBatchQuery({
 *   variables: {
 *      schema: // value for 'schema'
 *      storageUnits: // value for 'storageUnits'
 *   },
 * });
 */
export function useGetColumnsBatchQuery(baseOptions: Apollo.QueryHookOptions<GetColumnsBatchQuery, GetColumnsBatchQueryVariables> & ({ variables: GetColumnsBatchQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetColumnsBatchQuery, GetColumnsBatchQueryVariables>(GetColumnsBatchDocument, options);
      }
export function useGetColumnsBatchLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetColumnsBatchQuery, GetColumnsBatchQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetColumnsBatchQuery, GetColumnsBatchQueryVariables>(GetColumnsBatchDocument, options);
        }
export function useGetColumnsBatchSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetColumnsBatchQuery, GetColumnsBatchQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetColumnsBatchQuery, GetColumnsBatchQueryVariables>(GetColumnsBatchDocument, options);
        }
export type GetColumnsBatchQueryHookResult = ReturnType<typeof useGetColumnsBatchQuery>;
export type GetColumnsBatchLazyQueryHookResult = ReturnType<typeof useGetColumnsBatchLazyQuery>;
export type GetColumnsBatchSuspenseQueryHookResult = ReturnType<typeof useGetColumnsBatchSuspenseQuery>;
export type GetColumnsBatchQueryResult = Apollo.QueryResult<GetColumnsBatchQuery, GetColumnsBatchQueryVariables>;
export const GetColumnsDocument = gql`
    query GetColumns($schema: String!, $storageUnit: String!) {
  Columns(schema: $schema, storageUnit: $storageUnit) {
    Type
    Name
    IsPrimary
    IsForeignKey
    ReferencedTable
    ReferencedColumn
    Length
    Precision
    Scale
  }
}
    `;

/**
 * __useGetColumnsQuery__
 *
 * To run a query within a React component, call `useGetColumnsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetColumnsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetColumnsQuery({
 *   variables: {
 *      schema: // value for 'schema'
 *      storageUnit: // value for 'storageUnit'
 *   },
 * });
 */
export function useGetColumnsQuery(baseOptions: Apollo.QueryHookOptions<GetColumnsQuery, GetColumnsQueryVariables> & ({ variables: GetColumnsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetColumnsQuery, GetColumnsQueryVariables>(GetColumnsDocument, options);
      }
export function useGetColumnsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetColumnsQuery, GetColumnsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetColumnsQuery, GetColumnsQueryVariables>(GetColumnsDocument, options);
        }
export function useGetColumnsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetColumnsQuery, GetColumnsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetColumnsQuery, GetColumnsQueryVariables>(GetColumnsDocument, options);
        }
export type GetColumnsQueryHookResult = ReturnType<typeof useGetColumnsQuery>;
export type GetColumnsLazyQueryHookResult = ReturnType<typeof useGetColumnsLazyQuery>;
export type GetColumnsSuspenseQueryHookResult = ReturnType<typeof useGetColumnsSuspenseQuery>;
export type GetColumnsQueryResult = Apollo.QueryResult<GetColumnsQuery, GetColumnsQueryVariables>;
export const GetDatabaseMetadataDocument = gql`
    query GetDatabaseMetadata {
  DatabaseMetadata {
    databaseType
    typeDefinitions {
      id
      label
      hasLength
      hasPrecision
      defaultLength
      defaultPrecision
      category
    }
    operators
    aliasMap {
      Key
      Value
    }
    capabilities {
      supportsScratchpad
      supportsChat
      supportsGraph
      supportsSchema
      supportsDatabaseSwitch
      supportsModifiers
    }
    systemSchemas
  }
}
    `;

/**
 * __useGetDatabaseMetadataQuery__
 *
 * To run a query within a React component, call `useGetDatabaseMetadataQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetDatabaseMetadataQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetDatabaseMetadataQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetDatabaseMetadataQuery(baseOptions?: Apollo.QueryHookOptions<GetDatabaseMetadataQuery, GetDatabaseMetadataQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetDatabaseMetadataQuery, GetDatabaseMetadataQueryVariables>(GetDatabaseMetadataDocument, options);
      }
export function useGetDatabaseMetadataLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetDatabaseMetadataQuery, GetDatabaseMetadataQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetDatabaseMetadataQuery, GetDatabaseMetadataQueryVariables>(GetDatabaseMetadataDocument, options);
        }
export function useGetDatabaseMetadataSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetDatabaseMetadataQuery, GetDatabaseMetadataQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetDatabaseMetadataQuery, GetDatabaseMetadataQueryVariables>(GetDatabaseMetadataDocument, options);
        }
export type GetDatabaseMetadataQueryHookResult = ReturnType<typeof useGetDatabaseMetadataQuery>;
export type GetDatabaseMetadataLazyQueryHookResult = ReturnType<typeof useGetDatabaseMetadataLazyQuery>;
export type GetDatabaseMetadataSuspenseQueryHookResult = ReturnType<typeof useGetDatabaseMetadataSuspenseQuery>;
export type GetDatabaseMetadataQueryResult = Apollo.QueryResult<GetDatabaseMetadataQuery, GetDatabaseMetadataQueryVariables>;
export const GetDatabaseDocument = gql`
    query GetDatabase($type: String!) {
  Database(type: $type)
}
    `;

/**
 * __useGetDatabaseQuery__
 *
 * To run a query within a React component, call `useGetDatabaseQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetDatabaseQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetDatabaseQuery({
 *   variables: {
 *      type: // value for 'type'
 *   },
 * });
 */
export function useGetDatabaseQuery(baseOptions: Apollo.QueryHookOptions<GetDatabaseQuery, GetDatabaseQueryVariables> & ({ variables: GetDatabaseQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetDatabaseQuery, GetDatabaseQueryVariables>(GetDatabaseDocument, options);
      }
export function useGetDatabaseLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetDatabaseQuery, GetDatabaseQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetDatabaseQuery, GetDatabaseQueryVariables>(GetDatabaseDocument, options);
        }
export function useGetDatabaseSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetDatabaseQuery, GetDatabaseQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetDatabaseQuery, GetDatabaseQueryVariables>(GetDatabaseDocument, options);
        }
export type GetDatabaseQueryHookResult = ReturnType<typeof useGetDatabaseQuery>;
export type GetDatabaseLazyQueryHookResult = ReturnType<typeof useGetDatabaseLazyQuery>;
export type GetDatabaseSuspenseQueryHookResult = ReturnType<typeof useGetDatabaseSuspenseQuery>;
export type GetDatabaseQueryResult = Apollo.QueryResult<GetDatabaseQuery, GetDatabaseQueryVariables>;
export const RawExecuteDocument = gql`
    query RawExecute($query: String!) {
  RawExecute(query: $query) {
    Columns {
      Type
      Name
    }
    Rows
    TotalCount
  }
}
    `;

/**
 * __useRawExecuteQuery__
 *
 * To run a query within a React component, call `useRawExecuteQuery` and pass it any options that fit your needs.
 * When your component renders, `useRawExecuteQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useRawExecuteQuery({
 *   variables: {
 *      query: // value for 'query'
 *   },
 * });
 */
export function useRawExecuteQuery(baseOptions: Apollo.QueryHookOptions<RawExecuteQuery, RawExecuteQueryVariables> & ({ variables: RawExecuteQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<RawExecuteQuery, RawExecuteQueryVariables>(RawExecuteDocument, options);
      }
export function useRawExecuteLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<RawExecuteQuery, RawExecuteQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<RawExecuteQuery, RawExecuteQueryVariables>(RawExecuteDocument, options);
        }
export function useRawExecuteSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<RawExecuteQuery, RawExecuteQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<RawExecuteQuery, RawExecuteQueryVariables>(RawExecuteDocument, options);
        }
export type RawExecuteQueryHookResult = ReturnType<typeof useRawExecuteQuery>;
export type RawExecuteLazyQueryHookResult = ReturnType<typeof useRawExecuteLazyQuery>;
export type RawExecuteSuspenseQueryHookResult = ReturnType<typeof useRawExecuteSuspenseQuery>;
export type RawExecuteQueryResult = Apollo.QueryResult<RawExecuteQuery, RawExecuteQueryVariables>;
export const GetStorageUnitRowsDocument = gql`
    query GetStorageUnitRows($schema: String!, $storageUnit: String!, $where: WhereCondition, $sort: [SortCondition!], $pageSize: Int!, $pageOffset: Int!) {
  Row(
    schema: $schema
    storageUnit: $storageUnit
    where: $where
    sort: $sort
    pageSize: $pageSize
    pageOffset: $pageOffset
  ) {
    Columns {
      Type
      Name
      IsPrimary
      IsForeignKey
      ReferencedTable
      ReferencedColumn
      Length
      Precision
      Scale
    }
    Rows
    DisableUpdate
    TotalCount
  }
}
    `;

/**
 * __useGetStorageUnitRowsQuery__
 *
 * To run a query within a React component, call `useGetStorageUnitRowsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetStorageUnitRowsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetStorageUnitRowsQuery({
 *   variables: {
 *      schema: // value for 'schema'
 *      storageUnit: // value for 'storageUnit'
 *      where: // value for 'where'
 *      sort: // value for 'sort'
 *      pageSize: // value for 'pageSize'
 *      pageOffset: // value for 'pageOffset'
 *   },
 * });
 */
export function useGetStorageUnitRowsQuery(baseOptions: Apollo.QueryHookOptions<GetStorageUnitRowsQuery, GetStorageUnitRowsQueryVariables> & ({ variables: GetStorageUnitRowsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetStorageUnitRowsQuery, GetStorageUnitRowsQueryVariables>(GetStorageUnitRowsDocument, options);
      }
export function useGetStorageUnitRowsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetStorageUnitRowsQuery, GetStorageUnitRowsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetStorageUnitRowsQuery, GetStorageUnitRowsQueryVariables>(GetStorageUnitRowsDocument, options);
        }
export function useGetStorageUnitRowsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetStorageUnitRowsQuery, GetStorageUnitRowsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetStorageUnitRowsQuery, GetStorageUnitRowsQueryVariables>(GetStorageUnitRowsDocument, options);
        }
export type GetStorageUnitRowsQueryHookResult = ReturnType<typeof useGetStorageUnitRowsQuery>;
export type GetStorageUnitRowsLazyQueryHookResult = ReturnType<typeof useGetStorageUnitRowsLazyQuery>;
export type GetStorageUnitRowsSuspenseQueryHookResult = ReturnType<typeof useGetStorageUnitRowsSuspenseQuery>;
export type GetStorageUnitRowsQueryResult = Apollo.QueryResult<GetStorageUnitRowsQuery, GetStorageUnitRowsQueryVariables>;
export const GetSchemaDocument = gql`
    query GetSchema {
  Schema
}
    `;

/**
 * __useGetSchemaQuery__
 *
 * To run a query within a React component, call `useGetSchemaQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetSchemaQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetSchemaQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetSchemaQuery(baseOptions?: Apollo.QueryHookOptions<GetSchemaQuery, GetSchemaQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetSchemaQuery, GetSchemaQueryVariables>(GetSchemaDocument, options);
      }
export function useGetSchemaLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetSchemaQuery, GetSchemaQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetSchemaQuery, GetSchemaQueryVariables>(GetSchemaDocument, options);
        }
export function useGetSchemaSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetSchemaQuery, GetSchemaQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetSchemaQuery, GetSchemaQueryVariables>(GetSchemaDocument, options);
        }
export type GetSchemaQueryHookResult = ReturnType<typeof useGetSchemaQuery>;
export type GetSchemaLazyQueryHookResult = ReturnType<typeof useGetSchemaLazyQuery>;
export type GetSchemaSuspenseQueryHookResult = ReturnType<typeof useGetSchemaSuspenseQuery>;
export type GetSchemaQueryResult = Apollo.QueryResult<GetSchemaQuery, GetSchemaQueryVariables>;
export const GetStorageUnitsDocument = gql`
    query GetStorageUnits($schema: String!) {
  StorageUnit(schema: $schema) {
    Name
    Attributes {
      Key
      Value
    }
  }
}
    `;

/**
 * __useGetStorageUnitsQuery__
 *
 * To run a query within a React component, call `useGetStorageUnitsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetStorageUnitsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetStorageUnitsQuery({
 *   variables: {
 *      schema: // value for 'schema'
 *   },
 * });
 */
export function useGetStorageUnitsQuery(baseOptions: Apollo.QueryHookOptions<GetStorageUnitsQuery, GetStorageUnitsQueryVariables> & ({ variables: GetStorageUnitsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetStorageUnitsQuery, GetStorageUnitsQueryVariables>(GetStorageUnitsDocument, options);
      }
export function useGetStorageUnitsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetStorageUnitsQuery, GetStorageUnitsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetStorageUnitsQuery, GetStorageUnitsQueryVariables>(GetStorageUnitsDocument, options);
        }
export function useGetStorageUnitsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<GetStorageUnitsQuery, GetStorageUnitsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<GetStorageUnitsQuery, GetStorageUnitsQueryVariables>(GetStorageUnitsDocument, options);
        }
export type GetStorageUnitsQueryHookResult = ReturnType<typeof useGetStorageUnitsQuery>;
export type GetStorageUnitsLazyQueryHookResult = ReturnType<typeof useGetStorageUnitsLazyQuery>;
export type GetStorageUnitsSuspenseQueryHookResult = ReturnType<typeof useGetStorageUnitsSuspenseQuery>;
export type GetStorageUnitsQueryResult = Apollo.QueryResult<GetStorageUnitsQuery, GetStorageUnitsQueryVariables>;