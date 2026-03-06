export interface HttpRequest {
  id: string
  name: string
  method: HttpMethod
  url: string
  headers: Header[]
  body: RequestBody
  queryParams: QueryParam[]
  pathParams?: QueryParam[]
  auth: AuthConfig
  scripts?: Scripts
}

export interface HttpResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  size: number
  time: number
}

export interface Header {
  key: string
  value: string
  enabled: boolean
}

export interface QueryParam {
  key: string
  value: string
  enabled: boolean
}

export interface FormDataField {
  key: string
  value: string
  type: 'text' | 'file'
  fileName?: string
  fileContent?: string // base64 encoded
  enabled: boolean
}

export interface RequestBody {
  type: 'none' | 'json' | 'form-data' | 'raw' | 'binary'
  content: string
  formData?: FormDataField[]
  fileName?: string // for binary uploads
}

export interface AuthConfig {
  type: 'none' | 'basic' | 'bearer' | 'api-key'
  basic?: {
    username: string
    password: string
  }
  bearer?: {
    token: string
  }
  apiKey?: {
    key: string
    value: string
    in: 'header' | 'query'
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export interface Collection {
  id: string
  name: string
  path: string
  requests: HttpRequest[]
  folders: Folder[]
}

export interface Folder {
  id: string
  name: string
  path: string
  requests: HttpRequest[]
  folders: Folder[]
}

export interface Environment {
  id: string
  name: string
  variables: EnvironmentVariable[]
}

export interface EnvironmentVariable {
  key: string
  value: string
  enabled: boolean
  secret: boolean
}

export interface CollectionVar {
  key: string
  value: string
  enabled: boolean
  secret: boolean
}

export interface BruFile {
  meta: {
    name: string
    type: 'http'
    seq: number
  }
  http: {
    method: HttpMethod
    url: string
    headers: Header[]
    queryParams?: QueryParam[]
    pathParams?: QueryParam[]
  }
  body: RequestBody
  scripts?: Scripts
  vars?: Record<string, unknown>
  assertions?: string[]
}

export interface Scripts {
  language: 'javascript' | 'typescript'
  preRequest: string
  postResponse: string
}

export interface ApiResponse<T = unknown> {
  data: T
  message?: string
  success: boolean
}

export interface HistoryEntry {
  id: string
  timestamp: string
  method: HttpMethod
  url: string
  status: number
  statusText: string
  duration: number
  size: number
  headers: Record<string, string>
  body: string
  requestBody: string
}

export interface Template {
  id: string
  name: string
  description: string
  category: string
  method: HttpMethod
  url: string
  headers: Record<string, string>
  body: string
  bodyType: string
  createdAt: string
  updatedAt: string
}

export interface Cookie {
  id: string
  name: string
  value: string
  domain: string
  path: string
  expires: string
  secure: boolean
  httpOnly: boolean
  sameSite: string
  createdAt: string
  updatedAt: string
  collection?: string
}
