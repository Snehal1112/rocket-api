import { useMemo } from 'react'
import type { CollectionNode } from '@/lib/api'

export interface FlatTreeNode {
  node: CollectionNode
  depth: number
  parentIndex: number | null
  isExpanded: boolean
  path: string
  isFolder: boolean
  siblingCount: number
  positionInSet: number
}

export function useFlatTree(
  tree: CollectionNode | null | undefined,
  expandedPaths: Set<string>
): FlatTreeNode[] {
  return useMemo(() => {
    if (!tree?.children) return []

    const result: FlatTreeNode[] = []

    const traverse = (
      nodes: CollectionNode[],
      depth: number,
      parentIdx: number | null
    ) => {
      const renderableNodes = nodes.filter(
        n => n.type === 'folder' || n.type === 'request'
      )
      const siblingCount = renderableNodes.length

      for (let i = 0; i < renderableNodes.length; i++) {
        const node = renderableNodes[i]
        const isFolder = node.type === 'folder'
        const path = node.path || node.name
        const isExpanded = isFolder && expandedPaths.has(path)
        const currentIndex = result.length

        result.push({
          node,
          depth,
          parentIndex: parentIdx,
          isExpanded,
          path,
          isFolder,
          siblingCount,
          positionInSet: i + 1,
        })

        if (isExpanded && node.children) {
          traverse(node.children, depth + 1, currentIndex)
        }
      }
    }

    traverse(tree.children, 0, null)

    return result
  }, [tree, expandedPaths])
}
