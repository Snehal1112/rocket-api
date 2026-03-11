import { apiService } from '@/lib/api'
import { mockApiService } from '@/lib/mock-api'
import type { HttpRequest, HttpResponse } from '@/types'

export async function sendRequestWithFallback(
  request: HttpRequest,
  environmentVariables: Record<string, string>
): Promise<{ response: HttpResponse; usedMockService: boolean }> {
  try {
    const response = await apiService.sendRequest(request, environmentVariables)
    return {
      response,
      usedMockService: false,
    }
  } catch {
    const response = await mockApiService.sendRequest(request)
    return {
      response: {
        ...response,
        headers: {
          ...response.headers,
          'X-Rocket-Mock': 'true',
        },
      },
      usedMockService: true,
    }
  }
}

export const requestExecutionApi = {
  sendRequestWithFallback,
}

export default requestExecutionApi
