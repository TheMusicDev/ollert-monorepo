import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/boards/$boardId')({
  component: BoardDetailPage,
})

function BoardDetailPage() {
  const { boardId } = Route.useParams()
  // Stub — kanban view (lists + cards, drag-drop) wired up in feat/web-board-detail.
  return <div>Board {boardId}</div>
}
