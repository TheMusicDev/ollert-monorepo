<?php
declare(strict_types=1);

namespace App\Controller;

use App\Exception\ApiException;
use App\Model\Entity\Organization;
use App\Model\Entity\User;
use App\Model\Table\BoardsTable;
use App\Model\Table\OrganizationsTable;
use App\Model\Table\UsersTable;
use App\Service\OrgAuthorizationService;
use App\Service\QuotaService;
use Cake\Database\Driver\Mysql;
use Cake\ORM\Query\SelectQuery;

/**
 * `/api/orgs/:id/boards` and `/api/boards/:id*` — see
 * planning/api-contract.md#boards.
 *
 * Access is org-scoped, not per-board (planning/data-model.md): any member of
 * a board's org (owner or explicit `org_members` row, per
 * `App\Service\OrgAuthorizationService`) can view/rename/delete it. Only the
 * org's owner can create one, since creation is what consumes the owner's
 * `max_boards_per_org` quota (`App\Service\QuotaService`).
 */
class BoardsController extends AppController
{
    /**
     * @return void
     */
    public function initialize(): void
    {
        parent::initialize();

        $this->loadComponent('Pagination');

        // No templates for this API-only controller — every action serializes
        // its view vars straight to JSON (see the `serialize` option set per
        // action below).
        $this->viewBuilder()->setClassName('Json');
    }

    /**
     * `GET /api/orgs/:id/boards` — boards under an org, paginated.
     *
     * @param string $orgId `organizations.id` (UUID), from the route.
     * @return void
     */
    public function index(string $orgId): void
    {
        $this->request->allowMethod('GET');

        $user = $this->identity();
        $this->fetchOrgOrFail($orgId);
        $this->assertOrgMember($user, $orgId);

        $query = $this->boardsTable()->find()->where(['org_id' => $orgId]);
        $result = $this->Pagination->paginate($query);

        $this->set($result);
        $this->viewBuilder()->setOption('serialize', ['data', 'meta']);
    }

    /**
     * `POST /api/orgs/:id/boards` — create a board under the org. Org-owner
     * only (403 otherwise); 422 `quota_exceeded` if the owner is already at
     * `max_boards_per_org`.
     *
     * The count-check and the save happen inside one transaction, with a
     * locking read (`SELECT ... FOR UPDATE`, MySQL only — see
     * `lockOwnerRowForUpdate()`) on the quota-owning `users` row taken first,
     * so two concurrent create requests for the same org owner serialize
     * instead of both passing the count check before either insert commits.
     * This is the transaction boundary `App\Service\QuotaService::assertUnderQuota()`
     * documents as non-atomic on its own and leaves to the caller to own.
     *
     * @param string $orgId `organizations.id` (UUID), from the route.
     * @return void
     */
    public function add(string $orgId): void
    {
        $this->request->allowMethod('POST');

        $user = $this->identity();
        $org = $this->fetchOrgOrFail($orgId);
        $this->assertOrgOwner($user, $org);

        $boardsTable = $this->boardsTable();
        $connection = $boardsTable->getConnection();

        $board = $connection->transactional(function () use ($boardsTable, $org) {
            $this->lockOwnerRowForUpdate($org->owner_id);

            $this->quotaService()->assertUnderQuota(
                $boardsTable->find()->where(['org_id' => $org->id]),
                $org->owner_id,
                QuotaService::MAX_BOARDS_PER_ORG,
                "You have reached this organization's board quota.",
            );

            $board = $boardsTable->newEntity([
                'org_id' => $org->id,
                'title' => $this->request->getData('title'),
            ]);

            return $boardsTable->saveOrFail($board);
        });

        $this->set('board', $board);
        $this->viewBuilder()->setOption('serialize', 'board');
        $this->response = $this->response->withStatus(201);
    }

    /**
     * `GET /api/boards/:id` — board detail with lists + cards nested,
     * unpaginated (planning/api-contract.md#pagination). Any org member.
     *
     * @param string $id `boards.id` (UUID), from the route.
     * @return void
     */
    public function view(string $id): void
    {
        $this->request->allowMethod('GET');

        $user = $this->identity();
        $board = $this->boardsTable()->get(
            $id,
            contain: [
                'Lists' => fn(SelectQuery $q): SelectQuery => $q->orderBy(['Lists.position' => 'ASC']),
                'Lists.Cards' => fn(SelectQuery $q): SelectQuery => $q->orderBy(['Cards.position' => 'ASC']),
            ],
        );

        $this->assertOrgMember($user, $board->org_id);

        $this->set('board', $board);
        $this->viewBuilder()->setOption('serialize', 'board');
    }

    /**
     * `PATCH /api/boards/:id` — rename a board. Any org member.
     *
     * @param string $id `boards.id` (UUID), from the route.
     * @return void
     */
    public function edit(string $id): void
    {
        $this->request->allowMethod('PATCH');

        $user = $this->identity();
        $boardsTable = $this->boardsTable();
        $board = $boardsTable->get($id);

        $this->assertOrgMember($user, $board->org_id);

        $board = $boardsTable->patchEntity($board, $this->request->getData(), [
            'fields' => ['title'],
        ]);
        $boardsTable->saveOrFail($board);

        $this->set('board', $board);
        $this->viewBuilder()->setOption('serialize', 'board');
    }

    /**
     * `DELETE /api/boards/:id` — soft delete (automatic via
     * `Muffin/Trash.Trash`, see `App\Model\Table\BoardsTable`). Any org
     * member (no per-board owner in v1).
     *
     * @param string $id `boards.id` (UUID), from the route.
     * @return void
     */
    public function delete(string $id): void
    {
        $this->request->allowMethod('DELETE');

        $user = $this->identity();
        $boardsTable = $this->boardsTable();
        $board = $boardsTable->get($id);

        $this->assertOrgMember($user, $board->org_id);

        $boardsTable->delete($board);

        $this->autoRender = false;
        $this->response = $this->response->withStatus(204);
    }

    /**
     * The requesting user, as attached to the request by
     * `App\Middleware\AuthMiddleware` — always present, since every route on
     * this controller requires auth.
     *
     * @return \App\Model\Entity\User
     */
    private function identity(): User
    {
        /** @var \App\Model\Entity\User */
        return $this->request->getAttribute('identity');
    }

    /**
     * @param string $id `organizations.id` (UUID).
     * @return \App\Model\Entity\Organization
     */
    private function fetchOrgOrFail(string $id): Organization
    {
        /** @var \App\Model\Entity\Organization */
        return $this->organizationsTable()->get($id);
    }

    /**
     * @param \App\Model\Entity\User $user The requesting user.
     * @param string $orgId `organizations.id` (UUID).
     * @return void
     * @throws \App\Exception\ApiException 403 if $user isn't a member of $orgId.
     */
    private function assertOrgMember(User $user, string $orgId): void
    {
        if (!$this->orgAuthorizationService()->isOrgMember((string)$user->id, $orgId)) {
            throw new ApiException('You are not a member of this organization.', 'not_org_member', 403);
        }
    }

    /**
     * @param \App\Model\Entity\User $user The requesting user.
     * @param \App\Model\Entity\Organization $org The org being acted on.
     * @return void
     * @throws \App\Exception\ApiException 403 if $user doesn't own $org.
     */
    private function assertOrgOwner(User $user, Organization $org): void
    {
        if (!$this->orgAuthorizationService()->isOrgOwner((string)$user->id, (string)$org->id)) {
            throw new ApiException(
                'Only the organization owner can create boards.',
                'not_org_owner',
                403,
            );
        }
    }

    /**
     * Takes a `SELECT ... FOR UPDATE` locking read on the quota-owning
     * `users` row, so this transaction blocks any concurrent transaction
     * doing the same until this one commits — see `add()`'s docblock.
     *
     * MySQL only: SQLite (used by the test suite/CI, see tests/bootstrap.php)
     * has no row-level locking and rejects `FOR UPDATE` syntax outright, and
     * its single-writer model already serializes concurrent write
     * transactions without it.
     *
     * @param string $ownerId `users.id` (UUID) of the quota-owning user.
     * @return void
     */
    private function lockOwnerRowForUpdate(string $ownerId): void
    {
        $usersTable = $this->usersTable();
        $query = $usersTable->find()->where(['id' => $ownerId]);

        if ($usersTable->getConnection()->getDriver() instanceof Mysql) {
            $query->epilog('FOR UPDATE');
        }

        $query->firstOrFail();
    }

    /**
     * @return \App\Model\Table\BoardsTable
     */
    private function boardsTable(): BoardsTable
    {
        /** @var \App\Model\Table\BoardsTable */
        return $this->fetchTable('Boards');
    }

    /**
     * @return \App\Model\Table\OrganizationsTable
     */
    private function organizationsTable(): OrganizationsTable
    {
        /** @var \App\Model\Table\OrganizationsTable */
        return $this->fetchTable('Organizations');
    }

    /**
     * @return \App\Model\Table\UsersTable
     */
    private function usersTable(): UsersTable
    {
        /** @var \App\Model\Table\UsersTable */
        return $this->fetchTable('Users');
    }

    /**
     * @return \App\Service\OrgAuthorizationService
     */
    private function orgAuthorizationService(): OrgAuthorizationService
    {
        return new OrgAuthorizationService();
    }

    /**
     * @return \App\Service\QuotaService
     */
    private function quotaService(): QuotaService
    {
        return new QuotaService();
    }
}
