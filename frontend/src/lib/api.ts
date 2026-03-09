import axios, { AxiosInstance } from 'axios'
import { HttpRequest, HttpResponse, ApiResponse, Environment, HistoryEntry, Template, Cookie, CollectionVar } from '@/types'
import { getRuntimeConfig } from '@/lib/runtime-config'

export interface CollectionNode {
  name: string
  type: 'collection' | 'folder' | 'request' | 'environment' | 'file'
  path?: string
  method?: string
  children?: CollectionNode[]
}

export interface CollectionSummary {
  id: string
  name: string
  path: string
  requestCount: number
}

class ApiService {
  private client: AxiosInstance
  private readonly healthUrl: string

  constructor() {
    const runtimeConfig = getRuntimeConfig()
    this.healthUrl = runtimeConfig.healthUrl
    this.client = axios.create({
      baseURL: runtimeConfig.apiBaseUrl,
      timeout: 5000,
    })
  }

  async checkBackendHealth(): Promise<boolean> {
    try {
      await axios.get(this.healthUrl, { timeout: 2000 })
      return true
    } catch {
      return false
    }
  }

  async sendRequest(request: HttpRequest): Promise<HttpResponse> {
    const isAvailable = await this.checkBackendHealth()
    if (!isAvailable) {
      throw new Error('Backend not available')
    }

    const startTime = Date.now()
    
    try {
      const response = await this.client.post<ApiResponse<HttpResponse>>('/requests/send', {
        method: request.method,
        url: request.url,
        headers: request.headers.filter(h => h.enabled).reduce((acc, h) => {
          acc[h.key] = h.value
          return acc
        }, {} as Record<string, string>),
        body: request.body.content,
        bodyType: request.body.type,
        formData: request.body.formData,
        fileName: request.body.fileName,
        queryParams: request.queryParams.filter(q => q.enabled),
        auth: request.auth,
        scripts: request.scripts,
      })

      const endTime = Date.now()
      
      return {
        status: response.data.data.status,
        statusText: response.data.data.statusText,
        headers: response.data.data.headers,
        body: this.normalizeBody(response.data.data.body),
        size: response.data.data.size,
        time: endTime - startTime
      }
    } catch (error) {
      const endTime = Date.now()
      
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const axiosError = error as { response: { status: number; statusText: string; headers: Record<string, string>; data: unknown } }
        const errorBody = this.normalizeBody(axiosError.response.data)
        return {
          status: axiosError.response.status,
          statusText: axiosError.response.statusText,
          headers: axiosError.response.headers,
          body: errorBody,
          size: errorBody.length,
          time: endTime - startTime
        }
      }
      
      throw error
    }
  }

  // Collections
  async getCollections(): Promise<CollectionSummary[]> {
    const response = await this.client.get<ApiResponse<CollectionSummary[]>>('/collections')
    return response.data.data
  }

  async getCollection(name: string): Promise<CollectionNode> {
    const response = await this.client.get<ApiResponse<CollectionNode>>(`/collections/${name}`)
    return response.data.data
  }

  async createCollection(name: string): Promise<CollectionSummary> {
    const response = await this.client.post<ApiResponse<CollectionSummary>>('/collections', { name })
    return response.data.data
  }

  async deleteCollection(name: string): Promise<void> {
    await this.client.delete(`/collections/${name}`)
  }

  async createFolder(
    collection: string,
    parentPath: string | undefined,
    folderName: string
  ): Promise<{ path: string }> {
    const response = await this.client.post<ApiResponse<{ path: string }>>(
      `/collections/${collection}/folders`,
      { parentPath, folderName }
    )
    return response.data.data
  }

  async createRequest(
    collection: string,
    parentPath: string | undefined,
    requestName: string,
    method: string = 'GET'
  ): Promise<{ path: string }> {
    const response = await this.client.post<ApiResponse<{ path: string }>>(
      `/collections/${collection}/requests/new`,
      { parentPath, requestName, method }
    )
    return response.data.data
  }

  // Requests
  async getRequest(collection: string, path: string): Promise<unknown> {
    const response = await this.client.get<ApiResponse<unknown>>('/requests', {
      params: { collection, path }
    })
    return response.data.data
  }

  async saveRequest(collection: string, path: string | undefined, request: unknown): Promise<{ path: string }> {
    const response = await this.client.post<ApiResponse<{ path: string }>>('/requests', {
      collection,
      path,
      request
    })
    return response.data.data
  }

  async deleteRequest(collection: string, path: string): Promise<void> {
    await this.client.delete('/requests', {
      params: { collection, path }
    })
  }

  // Environments
  async getEnvironments(collection: string): Promise<string[]> {
    const response = await this.client.get<ApiResponse<string[]>>('/environments', {
      params: { collection }
    })
    return response.data.data
  }

  async getEnvironment(collection: string, name: string): Promise<Environment> {
    const response = await this.client.get<ApiResponse<Environment>>('/environments', {
      params: { collection, name }
    })
    return response.data.data
  }

  async saveEnvironment(collection: string, environment: Environment): Promise<void> {
    await this.client.post('/environments', {
      collection,
      environment
    })
  }

  async deleteEnvironment(collection: string, name: string): Promise<void> {
    await this.client.delete('/environments', {
      params: { collection, name }
    })
  }

  async getCollectionVariables(name: string): Promise<CollectionVar[]> {
    const response = await this.client.get<ApiResponse<CollectionVar[]>>(
      `/collections/${name}/variables`
    )
    return response.data.data ?? []
  }

  async saveCollectionVariables(name: string, variables: CollectionVar[]): Promise<void> {
    await this.client.post(`/collections/${name}/variables`, { variables })
  }

  // Import/Export
  async importBruno(file: File, name?: string): Promise<CollectionSummary> {
    const formData = new FormData()
    formData.append('file', file)
    if (name) formData.append('name', name)

    const response = await this.client.post<ApiResponse<CollectionSummary>>('/import/bruno', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return response.data.data
  }

  async exportBruno(collection: string): Promise<Blob> {
    const response = await this.client.get(`/export/bruno?collection=${collection}`, {
      responseType: 'blob'
    })
    return response.data
  }

  async importPostman(collection: unknown): Promise<CollectionSummary> {
    const response = await this.client.post<ApiResponse<CollectionSummary>>('/import/postman', collection)
    return response.data.data
  }

  async exportPostman(collection: string): Promise<unknown> {
    const response = await this.client.get(`/export/postman?collection=${collection}`)
    return response.data
  }

  // History
  async getHistory(limit?: number): Promise<HistoryEntry[]> {
    const params = limit ? `?limit=${limit}` : ''
    const response = await this.client.get<ApiResponse<HistoryEntry[]>>(`/history${params}`)
    return response.data.data || []
  }

  async getHistoryEntry(id: string): Promise<HistoryEntry> {
    const response = await this.client.get<ApiResponse<HistoryEntry>>(`/history/detail?id=${id}`)
    return response.data.data
  }

  async deleteHistoryEntry(id: string): Promise<void> {
    await this.client.delete(`/history/detail?id=${id}`)
  }

  async clearHistory(): Promise<void> {
    await this.client.delete('/history')
  }

  // Templates
  async getTemplates(category?: string): Promise<Template[]> {
    const params = category ? `?category=${category}` : ''
    const response = await this.client.get<ApiResponse<Template[]>>(`/templates${params}`)
    return response.data.data || []
  }

  async getTemplateCategories(): Promise<string[]> {
    const response = await this.client.get<ApiResponse<string[]>>('/templates/categories')
    return response.data.data || []
  }

  async createTemplate(template: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>): Promise<Template> {
    const response = await this.client.post<ApiResponse<Template>>('/templates', template)
    return response.data.data
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.client.delete(`/templates/detail?id=${id}`)
  }

  // Cookies
  async getCookies(domain?: string): Promise<Cookie[]> {
    const params = domain ? `?domain=${domain}` : ''
    const response = await this.client.get<ApiResponse<Cookie[]>>(`/cookies${params}`)
    return response.data.data || []
  }

  async getCookieDomains(): Promise<string[]> {
    const response = await this.client.get<ApiResponse<string[]>>('/cookies/domains')
    return response.data.data || []
  }

  async createCookie(cookie: Omit<Cookie, 'id' | 'createdAt' | 'updatedAt'>): Promise<Cookie> {
    const response = await this.client.post<ApiResponse<Cookie>>('/cookies', cookie)
    return response.data.data
  }

  async deleteCookie(id: string): Promise<void> {
    await this.client.delete(`/cookies/detail?id=${id}`)
  }

  async clearCookies(): Promise<void> {
    await this.client.delete('/cookies')
  }

  async clearExpiredCookies(): Promise<number> {
    const response = await this.client.post<ApiResponse<number>>('/cookies/clear-expired')
    return response.data.data || 0
  }

  private normalizeBody(body: unknown): string {
    if (typeof body === 'string') return body
    if (body == null) return ''
    try {
      return JSON.stringify(body, null, 2)
    } catch {
      return '[unserializable]'
    }
  }
}

export const apiService = new ApiService()
