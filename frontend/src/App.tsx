import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-100">
        <div className="container mx-auto p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Rocket API
          </h1>
          <p className="text-gray-600">
            Bruno-inspired API testing tool
          </p>
        </div>
      </div>
    </QueryClientProvider>
  )
}

export default App
