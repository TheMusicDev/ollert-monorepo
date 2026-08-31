<?php
declare(strict_types=1);

namespace App\Controller;

use App\Exception\ApiException;
use App\Model\Entity\Organization;
use App\Model\Table\UsersTable;
use App\Service\AuditLogService;
use App\Service\OrgAuthorizationService;
use App\Service\QuotaService;
use Cake\Database\Driver\Mysql;
use Cake\Http\Response;

/**
 * `/api/orgs*` — planning/api-contract.md#organizations.
 *
 * `$this->Organizations` is CakePHP's default-table magic property
 * (`Controller::__get()`, driven by the controller's name) — no explicit
 * `fetchTable()` needed for the controller's own primary table, only for the
 * secondary ones (`Users`) this controller also touches.
 */
class OrganizationsController extends AppController
{
    private OrgAuthorizationService $orgAuth;

    private QuotaService $quota;

    private AuditLogService $auditLog;

    /**
     * @return void
     */
    public function initialize(): void
    {
        parent::initialize();

        $this->loadComponent('Pagination');

        $this->orgAuth = new OrgAuthorizationService();
        $this->quota = new QuotaService();
        $this->auditLog = new AuditLogService();
    }

    /**
     * `GET /api/orgs` — orgs the current user owns or is a member of,
     * paginated.
     *
     * @return \Cake\Http\Response
     */
    public function index(): Response
    {
        $this->request->allowMethod('GET');
        $userId = $this->currentUserId();

        $memberOrgIds = $this->fetchTable('OrgMembers')
            ->find()
            ->select(['org_id'])
            ->where(['user_id' => $userId])
            ->all()
            ->extract('org_id')
            ->toArray();

        $conditions = $memberOrgIds === []
            ? ['owner_id' => $userId]
            : ['OR' => ['owner_id' => $userId, 'id IN' => $memberOrgIds]];

        $query = $this->Organizations->find()
            ->where($conditions)
            ->orderBy(['created' => 'ASC']);

        $result = $this->Pagination->paginate($query);
        $result['data'] = array_map(
            fn(Organization $org): array => $this->serializeOrg($org, $userId),
            iterator_to_array($result['data']),
        );

        return $this->renderJson($result, 200);
    }

    /**
     * `POST /api/orgs` — create an org (creator becomes owner); 422
     * `quota_exceeded` if the creator is at their `max_orgs` quota.
     *
     * Wraps the quota count-check and the save in one transaction, with a
     * locking read of the owner's `users` row taken first (see
     * `App\Service\QuotaService`'s docblock on the non-atomicity of a bare
     * check-then-act quota check) so two concurrent create requests for the
     * same owner can't both pass the check before either commits. The
     * locking read is MySQL-specific (`SELECT ... FOR UPDATE`); it's skipped
     * on SQLite (used by the test suite, see CLAUDE.md's Learnings &
     * Corrections) since SQLite has no such syntax and instead serializes
     * writers at the whole-database level within a transaction, giving the
     * same guarantee for this single-row use case.
     *
     * @return \Cake\Http\Response
     */
    public function add(): Response
    {
        $this->request->allowMethod('POST');
        $userId = $this->currentUserId();
        $name = (string)($this->request->getData('name') ?? '');

        $usersTable = $this->fetchTable('Users');
        $connection = $this->Organizations->getConnection();

        /** @var \App\Model\Entity\Organization $org */
        $org = $connection->transactional(function () use ($usersTable, $userId, $name) {
            $this->lockOwnerRow($usersTable, $userId);

            $countQuery = $this->Organizations->find()->where(['owner_id' => $userId]);
            $this->quota->assertUnderQuota(
                $countQuery,
                $userId,
                QuotaService::MAX_ORGS,
                'You have reached your organization quota.',
            );

            $org = $this->Organizations->newEntity(['name' => $name]);
            $org->owner_id = $userId;

            return $this->Organizations->saveOrFail($org);
        });

        $this->auditLog->write(
            $userId,
            $org->id,
            'organization',
            $org->id,
            'create',
            $this->auditLog->diffForCreate($org),
        );

        return $this->renderJson($this->serializeOrg($org, $userId), 201);
    }

    /**
     * `GET /api/orgs/:id` — org detail, includes its (non-trashed) boards.
     *
     * @param string $id Organization id.
     * @return \Cake\Http\Response
     */
    public function view(string $id): Response
    {
        $this->request->allowMethod('GET');
        $userId = $this->currentUserId();

        $org = $this->fetchOrgOrFail($id, ['Boards']);
        $this->assertMember($userId, $org->id);

        return $this->renderJson($this->serializeOrg($org, $userId), 200);
    }

    /**
     * `PATCH /api/orgs/:id` — rename org. Owner or any member may rename
     * (no roles in v1 — see planning/data-model.md#org_members).
     *
     * @param string $id Organization id.
     * @return \Cake\Http\Response
     */
    public function edit(string $id): Response
    {
        $this->request->allowMethod('PATCH');
        $userId = $this->currentUserId();

        $org = $this->fetchOrgOrFail($id);
        $this->assertMember($userId, $org->id);

        $this->Organizations->patchEntity($org, [
            'name' => $this->request->getData('name'),
        ]);
        $diff = $this->auditLog->diffForUpdate($org);
        $this->Organizations->saveOrFail($org);

        $this->auditLog->write($userId, $org->id, 'organization', $org->id, 'update', $diff);

        return $this->renderJson($this->serializeOrg($org, $userId), 200);
    }

    /**
     * `DELETE /api/orgs/:id` — owner only; soft delete via `TrashBehavior`.
     *
     * @param string $id Organization id.
     * @return \Cake\Http\Response
     */
    public function delete(string $id): Response
    {
        $this->request->allowMethod('DELETE');
        $userId = $this->currentUserId();

        $org = $this->fetchOrgOrFail($id);
        if (!$this->orgAuth->isOrgOwner($userId, $org->id)) {
            throw new ApiException('Only the organization owner can delete it.', 'not_org_owner', 403);
        }

        $diff = $this->auditLog->diffForDelete($org);
        $this->Organizations->delete($org);

        $this->auditLog->write($userId, $org->id, 'organization', $org->id, 'delete', $diff);

        return $this->noContent();
    }

    /**
     * @return string Local `users.id` (UUID) of the authenticated request.
     */
    private function currentUserId(): string
    {
        /** @var \App\Model\Entity\User $identity */
        $identity = $this->request->getAttribute('identity');

        return $identity->id;
    }

    /**
     * Fetches an org by id (404 `not_found` if missing or soft-deleted — see
     * `Cake\Datasource\Exception\RecordNotFoundException`, which
     * `App\Error\JsonExceptionRenderer` renders with `code: "not_found"`
     * regardless of exception type).
     *
     * @param string $id Organization id.
     * @param array<string> $contain Associations to eager-load.
     * @return \App\Model\Entity\Organization
     */
    private function fetchOrgOrFail(string $id, array $contain = []): Organization
    {
        /** @var \App\Model\Entity\Organization */
        return $this->Organizations->get($id, contain: $contain);
    }

    /**
     * @param string $userId Local `users.id` (UUID).
     * @param string $orgId Organization id.
     * @return void
     * @throws \App\Exception\ApiException 403 `not_org_member` if not a member.
     */
    private function assertMember(string $userId, string $orgId): void
    {
        if (!$this->orgAuth->isOrgMember($userId, $orgId)) {
            throw new ApiException('You are not a member of this organization.', 'not_org_member', 403);
        }
    }

    /**
     * Locks the owner's `users` row (MySQL `SELECT ... FOR UPDATE`; skipped
     * on SQLite, see `add()`'s docblock) so concurrent `add()` calls for the
     * same owner serialize instead of racing past the quota check.
     *
     * @param \App\Model\Table\UsersTable $usersTable The Users table.
     * @param string $userId Local `users.id` (UUID) to lock.
     * @return void
     */
    private function lockOwnerRow(UsersTable $usersTable, string $userId): void
    {
        $query = $usersTable->find()->where(['id' => $userId]);
        if ($usersTable->getConnection()->getDriver() instanceof Mysql) {
            $query->epilog('FOR UPDATE');
        }
        $query->firstOrFail();
    }

    /**
     * Org resource shape: the raw `organizations` row plus the
     * server-computed `is_owner` field
     * (planning/api-contract.md#organizations).
     *
     * @param \App\Model\Entity\Organization $org The org entity.
     * @param string $userId Local `users.id` (UUID) of the requesting user.
     * @return array<string, mixed>
     */
    private function serializeOrg(Organization $org, string $userId): array
    {
        $data = $org->toArray();
        $data['is_owner'] = $this->orgAuth->isOrgOwner($userId, $org->id);

        return $data;
    }

    /**
     * @param mixed $data The response payload.
     * @param int $status HTTP status code.
     * @return \Cake\Http\Response
     */
    private function renderJson(mixed $data, int $status): Response
    {
        $this->autoRender = false;

        return $this->response
            ->withStatus($status)
            ->withType('application/json')
            ->withStringBody((string)json_encode(
                $data,
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
            ));
    }

    /**
     * @return \Cake\Http\Response 204 No Content.
     */
    private function noContent(): Response
    {
        $this->autoRender = false;

        return $this->response->withStatus(204);
    }
}
