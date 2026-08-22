<?php
declare(strict_types=1);

namespace App\Controller;

use App\Exception\ApiException;
use App\Model\Entity\Board;
use App\Model\Entity\BoardList;
use App\Model\Entity\User;
use App\Model\Table\ListsTable;
use App\Service\OrgAuthorizationService;
use App\Service\QuotaService;
use Cake\Database\Driver\Sqlite;
use Cake\Datasource\EntityInterface;
use Cake\Http\Exception\NotFoundException;
use Cake\Http\Response;

/**
 * `/api/boards/:id/lists` and `/api/lists/:id` (planning/api-contract.md#lists):
 *
 * - `add` - create a list under a board. Any org member. 422
 *   `quota_exceeded` against the org owner's `max_lists_per_board`
 *   (planning/data-model.md#quotas). The first list in an otherwise-empty
 *   board bootstraps `position` to `1.0`
 *   (planning/data-model.md, fractional-indexing note); every list after
 *   that is appended at `max(position) + 1.0`.
 * - `edit` - partial update: rename (`title`), reposition (`position`), or
 *   both in the same request. Only the keys actually present in the request
 *   body are touched — a `position`-only PATCH must not clobber `title`,
 *   and vice versa (planning/api-contract.md#conventions).
 * - `delete` - soft delete via `Muffin\Trash\Model\Behavior\TrashBehavior`.
 *
 * Every action requires the requesting user (`$request->getAttribute('identity')`,
 * set by `App\Middleware\AuthMiddleware`) to be a member of the org that owns
 * the list's board (`App\Service\OrgAuthorizationService::isOrgMember()`) —
 * 403 `not_org_member` otherwise. A board/list that doesn't exist or is
 * already soft-deleted 404s.
 */
class ListsController extends AppController
{
    private OrgAuthorizationService $orgAuthorizationService;

    private QuotaService $quotaService;

    /**
     * @return void
     */
    public function initialize(): void
    {
        parent::initialize();

        $this->orgAuthorizationService = new OrgAuthorizationService();
        $this->quotaService = new QuotaService();
        $this->autoRender = false;
    }

    /**
     * `POST /api/boards/:id/lists`
     *
     * @param string $boardId The board's `id` (from the route).
     * @return \Cake\Http\Response
     */
    public function add(string $boardId): Response
    {
        $this->request->allowMethod('POST');

        $identity = $this->identity();
        $board = $this->findBoardOrFail($boardId);
        $this->assertOrgMember($identity, $board->org_id);

        /** @var \App\Model\Table\ListsTable $listsTable */
        $listsTable = $this->fetchTable('Lists');
        $organization = $this->fetchTable('Organizations')->find()
            ->where(['id' => $board->org_id])
            ->firstOrFail();

        $list = $listsTable->getConnection()->transactional(
            function () use ($listsTable, $board, $organization): BoardList {
                // Lock the quota-owning user's row first so a concurrent
                // "add a list to this board" request for the same owner
                // serializes instead of racing the count-then-insert check
                // (see QuotaService's documented non-atomicity caveat).
                // SQLite has no `SELECT ... FOR UPDATE` — it serializes
                // writers at the transaction level instead, so the epilog
                // is skipped there (only used by the throwaway test DB when
                // `DATABASE_TEST_URL` is unset; MariaDB is used everywhere
                // else per api/.env.example).
                $ownerLockQuery = $this->fetchTable('Users')->find()
                    ->where(['id' => $organization->owner_id]);
                if (!$listsTable->getConnection()->getDriver() instanceof Sqlite) {
                    $ownerLockQuery->epilog('FOR UPDATE');
                }
                $ownerLockQuery->firstOrFail();

                $countQuery = $listsTable->find()->where(['board_id' => $board->id]);
                $this->quotaService->assertUnderQuota(
                    $countQuery,
                    $organization->owner_id,
                    QuotaService::MAX_LISTS_PER_BOARD,
                    'This board has reached its list quota.',
                );

                $entity = $listsTable->newEntity([
                    'board_id' => $board->id,
                    'title' => (string)$this->request->getData('title'),
                    'position' => $this->nextPosition($listsTable, $board->id),
                ]);

                return $listsTable->saveOrFail($entity);
            },
        );

        return $this->jsonResponse($list, 201);
    }

    /**
     * `PATCH /api/lists/:id` - rename, reposition, or both (partial update:
     * only `title`/`position` keys actually present in the request body are
     * applied).
     *
     * @param string $id The list's `id` (from the route).
     * @return \Cake\Http\Response
     */
    public function edit(string $id): Response
    {
        $this->request->allowMethod('PATCH');

        $identity = $this->identity();
        $list = $this->findListOrFail($id);
        $this->assertOrgMember($identity, $this->orgIdForBoard($list->board_id));

        /** @var \App\Model\Table\ListsTable $listsTable */
        $listsTable = $this->fetchTable('Lists');

        // Only mass-assign keys the client actually sent, so a
        // `position`-only PATCH never clobbers `title` (and vice versa) —
        // patchEntity() only touches fields present in $data, but this also
        // guards against any other field slipping through.
        $data = array_intersect_key($this->request->getData(), array_flip(['title', 'position']));

        $listsTable->patchEntity($list, $data);
        $listsTable->saveOrFail($list);

        return $this->jsonResponse($list);
    }

    /**
     * `DELETE /api/lists/:id` - soft delete.
     *
     * @param string $id The list's `id` (from the route).
     * @return \Cake\Http\Response
     */
    public function delete(string $id): Response
    {
        $this->request->allowMethod('DELETE');

        $identity = $this->identity();
        $list = $this->findListOrFail($id);
        $this->assertOrgMember($identity, $this->orgIdForBoard($list->board_id));

        $this->fetchTable('Lists')->delete($list);

        return $this->jsonResponse($list);
    }

    /**
     * The `position` a newly created list should get: `1.0` if the board has
     * no lists yet, otherwise `max(position) + 1.0` (append to the end) —
     * see planning/data-model.md's fractional-indexing note.
     *
     * @param \App\Model\Table\ListsTable $listsTable The Lists table.
     * @param string $boardId The board's `id`.
     * @return float
     */
    private function nextPosition(ListsTable $listsTable, string $boardId): float
    {
        $query = $listsTable->find();
        $row = $query
            ->select(['maxPosition' => $query->func()->max('position')])
            ->where(['board_id' => $boardId])
            ->first();

        $max = $row?->get('maxPosition');

        return $max === null ? 1.0 : (float)$max + 1.0;
    }

    /**
     * @param string $boardId The board's `id`.
     * @return \App\Model\Entity\Board
     */
    private function findBoardOrFail(string $boardId): Board
    {
        /** @var \App\Model\Entity\Board|null $board */
        $board = $this->fetchTable('Boards')->find()
            ->where(['id' => $boardId])
            ->first();

        if ($board === null) {
            throw new NotFoundException('Board not found.');
        }

        return $board;
    }

    /**
     * @param string $id The list's `id`.
     * @return \App\Model\Entity\BoardList
     */
    private function findListOrFail(string $id): BoardList
    {
        /** @var \App\Model\Entity\BoardList|null $list */
        $list = $this->fetchTable('Lists')->find()
            ->where(['Lists.id' => $id])
            ->first();

        if ($list === null) {
            throw new NotFoundException('List not found.');
        }

        return $list;
    }

    /**
     * @param string $boardId The board's `id`.
     * @return string The board's `org_id`.
     */
    private function orgIdForBoard(string $boardId): string
    {
        /** @var \App\Model\Entity\Board|null $board */
        $board = $this->fetchTable('Boards')->find()
            ->select(['id', 'org_id'])
            ->where(['id' => $boardId])
            ->first();

        if ($board === null) {
            throw new NotFoundException('Board not found.');
        }

        return $board->org_id;
    }

    /**
     * @param \App\Model\Entity\User $identity The authenticated user.
     * @param string $orgId The org to check membership against.
     * @return void
     * @throws \App\Exception\ApiException 403 `not_org_member` when $identity
     *   isn't a member of $orgId.
     */
    private function assertOrgMember(User $identity, string $orgId): void
    {
        if (!$this->orgAuthorizationService->isOrgMember($identity->id, $orgId)) {
            throw new ApiException(
                'You are not a member of this organization.',
                'not_org_member',
                403,
            );
        }
    }

    /**
     * @return \App\Model\Entity\User
     */
    private function identity(): User
    {
        /** @var \App\Model\Entity\User $identity */
        $identity = $this->request->getAttribute('identity');

        return $identity;
    }

    /**
     * @param \Cake\Datasource\EntityInterface $entity The resource to serialize.
     * @param int $status HTTP status code.
     * @return \Cake\Http\Response
     */
    private function jsonResponse(EntityInterface $entity, int $status = 200): Response
    {
        return $this->response
            ->withStatus($status)
            ->withType('application/json')
            ->withStringBody((string)json_encode(
                $entity,
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
            ));
    }
}
