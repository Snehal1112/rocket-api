import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFlatTree } from '../use-flat-tree'
import type { CollectionNode } from '@/lib/api'

const makeTree = (children: CollectionNode[]): CollectionNode => ({
  name: 'root',
  type: 'collection',
  children,
})

describe('useFlatTree', () => {
  it('returns empty array for null tree', () => {
    const { result } = renderHook(() => useFlatTree(null, new Set()))
    expect(result.current).toEqual([])
  })

  it('returns empty array for undefined tree', () => {
    const { result } = renderHook(() => useFlatTree(undefined, new Set()))
    expect(result.current).toEqual([])
  })

  it('returns empty array for tree with no children', () => {
    const tree: CollectionNode = { name: 'root', type: 'collection' }
    const { result } = renderHook(() => useFlatTree(tree, new Set()))
    expect(result.current).toEqual([])
  })

  it('flattens a single request', () => {
    const tree = makeTree([
      { name: 'Get Users', type: 'request', path: 'users/get.bru', method: 'GET' },
    ])
    const { result } = renderHook(() => useFlatTree(tree, new Set()))

    expect(result.current).toHaveLength(1)
    expect(result.current[0]).toEqual({
      node: tree.children![0],
      depth: 0,
      parentIndex: null,
      isExpanded: false,
      path: 'users/get.bru',
      isFolder: false,
      siblingCount: 1,
      positionInSet: 1,
    })
  })

  it('flattens multiple sibling requests with correct positionInSet', () => {
    const tree = makeTree([
      { name: 'A', type: 'request', path: 'a.bru', method: 'GET' },
      { name: 'B', type: 'request', path: 'b.bru', method: 'POST' },
      { name: 'C', type: 'request', path: 'c.bru', method: 'PUT' },
    ])
    const { result } = renderHook(() => useFlatTree(tree, new Set()))

    expect(result.current).toHaveLength(3)
    expect(result.current[0].siblingCount).toBe(3)
    expect(result.current[0].positionInSet).toBe(1)
    expect(result.current[1].positionInSet).toBe(2)
    expect(result.current[2].positionInSet).toBe(3)
  })

  it('does not descend into collapsed folders', () => {
    const tree = makeTree([
      {
        name: 'auth',
        type: 'folder',
        path: 'auth',
        children: [
          { name: 'Login', type: 'request', path: 'auth/login.bru', method: 'POST' },
        ],
      },
    ])
    const { result } = renderHook(() => useFlatTree(tree, new Set()))

    expect(result.current).toHaveLength(1)
    expect(result.current[0].isFolder).toBe(true)
    expect(result.current[0].isExpanded).toBe(false)
  })

  it('descends into expanded folders', () => {
    const tree = makeTree([
      {
        name: 'auth',
        type: 'folder',
        path: 'auth',
        children: [
          { name: 'Login', type: 'request', path: 'auth/login.bru', method: 'POST' },
          { name: 'Logout', type: 'request', path: 'auth/logout.bru', method: 'POST' },
        ],
      },
    ])
    const expanded = new Set(['auth'])
    const { result } = renderHook(() => useFlatTree(tree, expanded))

    expect(result.current).toHaveLength(3)
    expect(result.current[0].isFolder).toBe(true)
    expect(result.current[0].isExpanded).toBe(true)
    expect(result.current[0].depth).toBe(0)
    expect(result.current[1].node.name).toBe('Login')
    expect(result.current[1].depth).toBe(1)
    expect(result.current[1].parentIndex).toBe(0)
    expect(result.current[2].node.name).toBe('Logout')
    expect(result.current[2].depth).toBe(1)
    expect(result.current[2].parentIndex).toBe(0)
  })

  it('computes nested depth and parentIndex correctly', () => {
    const tree = makeTree([
      {
        name: 'auth',
        type: 'folder',
        path: 'auth',
        children: [
          {
            name: 'admin',
            type: 'folder',
            path: 'auth/admin',
            children: [
              { name: 'Reset', type: 'request', path: 'auth/admin/reset.bru', method: 'POST' },
            ],
          },
        ],
      },
    ])
    const expanded = new Set(['auth', 'auth/admin'])
    const { result } = renderHook(() => useFlatTree(tree, expanded))

    expect(result.current).toHaveLength(3)
    // auth folder
    expect(result.current[0].depth).toBe(0)
    expect(result.current[0].parentIndex).toBe(null)
    // admin folder
    expect(result.current[1].depth).toBe(1)
    expect(result.current[1].parentIndex).toBe(0)
    // Reset request
    expect(result.current[2].depth).toBe(2)
    expect(result.current[2].parentIndex).toBe(1)
  })

  it('computes siblingCount per folder level', () => {
    const tree = makeTree([
      { name: 'A', type: 'request', path: 'a.bru', method: 'GET' },
      {
        name: 'folder1',
        type: 'folder',
        path: 'folder1',
        children: [
          { name: 'B', type: 'request', path: 'folder1/b.bru', method: 'POST' },
          { name: 'C', type: 'request', path: 'folder1/c.bru', method: 'PUT' },
          { name: 'D', type: 'request', path: 'folder1/d.bru', method: 'DELETE' },
        ],
      },
    ])
    const expanded = new Set(['folder1'])
    const { result } = renderHook(() => useFlatTree(tree, expanded))

    // Top-level: 2 siblings (A + folder1)
    expect(result.current[0].siblingCount).toBe(2)
    expect(result.current[1].siblingCount).toBe(2)
    // Inside folder1: 3 siblings (B, C, D)
    expect(result.current[2].siblingCount).toBe(3)
    expect(result.current[3].siblingCount).toBe(3)
    expect(result.current[4].siblingCount).toBe(3)
  })

  it('filters out environment and file nodes', () => {
    const tree = makeTree([
      { name: 'dev', type: 'environment', path: 'environments/dev.bru' },
      { name: 'readme', type: 'file', path: 'README.md' },
      { name: 'Get Users', type: 'request', path: 'get-users.bru', method: 'GET' },
    ])
    const { result } = renderHook(() => useFlatTree(tree, new Set()))

    expect(result.current).toHaveLength(1)
    expect(result.current[0].node.name).toBe('Get Users')
    expect(result.current[0].siblingCount).toBe(1)
    expect(result.current[0].positionInSet).toBe(1)
  })

  it('uses node.name as path when node.path is undefined', () => {
    const tree = makeTree([
      { name: 'MyFolder', type: 'folder' },
    ])
    const { result } = renderHook(() => useFlatTree(tree, new Set()))
    expect(result.current[0].path).toBe('MyFolder')
  })

  it('is memoized — returns same reference for unchanged inputs', () => {
    const tree = makeTree([
      { name: 'R', type: 'request', path: 'r.bru', method: 'GET' },
    ])
    const expanded = new Set<string>()
    const { result, rerender } = renderHook(() => useFlatTree(tree, expanded))

    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it('recomputes when tree identity changes', () => {
    const tree1 = makeTree([
      { name: 'A', type: 'request', path: 'a.bru', method: 'GET' },
    ])
    const tree2 = makeTree([
      { name: 'B', type: 'request', path: 'b.bru', method: 'POST' },
    ])
    const expanded = new Set<string>()

    const { result, rerender } = renderHook(
      ({ tree }) => useFlatTree(tree, expanded),
      { initialProps: { tree: tree1 } }
    )

    const first = result.current
    rerender({ tree: tree2 })
    expect(result.current).not.toBe(first)
    expect(result.current[0].node.name).toBe('B')
  })

  it('recomputes when expandedPaths identity changes', () => {
    const tree = makeTree([
      {
        name: 'f',
        type: 'folder',
        path: 'f',
        children: [
          { name: 'X', type: 'request', path: 'f/x.bru', method: 'GET' },
        ],
      },
    ])
    const collapsed = new Set<string>()
    const expanded = new Set(['f'])

    const { result, rerender } = renderHook(
      ({ exp }) => useFlatTree(tree, exp),
      { initialProps: { exp: collapsed } }
    )

    expect(result.current).toHaveLength(1)
    rerender({ exp: expanded })
    expect(result.current).toHaveLength(2)
  })

  it('handles mixed folders and requests at same level', () => {
    const tree = makeTree([
      { name: 'Get', type: 'request', path: 'get.bru', method: 'GET' },
      {
        name: 'auth',
        type: 'folder',
        path: 'auth',
        children: [
          { name: 'Login', type: 'request', path: 'auth/login.bru', method: 'POST' },
        ],
      },
      { name: 'Post', type: 'request', path: 'post.bru', method: 'POST' },
    ])
    const expanded = new Set(['auth'])
    const { result } = renderHook(() => useFlatTree(tree, expanded))

    expect(result.current).toHaveLength(4)
    expect(result.current[0].node.name).toBe('Get')
    expect(result.current[0].positionInSet).toBe(1)
    expect(result.current[1].node.name).toBe('auth')
    expect(result.current[1].positionInSet).toBe(2)
    expect(result.current[2].node.name).toBe('Login')
    expect(result.current[2].depth).toBe(1)
    expect(result.current[2].positionInSet).toBe(1)
    expect(result.current[2].siblingCount).toBe(1)
    expect(result.current[3].node.name).toBe('Post')
    expect(result.current[3].positionInSet).toBe(3)
  })

  it('empty children array produces empty result', () => {
    const tree = makeTree([])
    const { result } = renderHook(() => useFlatTree(tree, new Set()))
    expect(result.current).toEqual([])
  })
})
