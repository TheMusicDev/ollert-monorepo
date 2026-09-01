<?php
declare(strict_types=1);

namespace App\Controller;

use App\Exception\ApiException;
use App\Model\Entity\User;
use App\Service\AuditLogService;

/**
 * `/api/admin/users*` — planning/api-contract.md#admin.
 *
 * Gated: the caller's `is_admin` (resolved per-request onto the identity
 * loaded by `App\Middleware\AuthMiddleware`, never JWT-embedded) must be
 * true, else 403 `not_admin`.
 */
class AdminUsersController extends AppController
{
    private AuditLogService $auditLog;

    /**
     * @return void
     */
    public function initialize(): void
    {
        parent::initialize();

        $this->loadComponent('Pagination');
        $this->viewBuilder()->setClassName('Json');

        $this->auditLog = new AuditLogService();

        $this->assertAdmin();
    }

    /**
     * `GET /api/admin/users` — paginated list of every user.
     *
     * @return void
     */
    public function index(): void
    {
        $this->request->allowMethod('GET');

        $query = $this->fetchTable('Users')->find()
            ->select([
                'id', 'email', 'display_name',
                'max_orgs', 'max_boards_per_org', 'max_lists_per_board', 'max_cards_per_board',
                'is_admin',
            ])
            ->orderBy(['created' => 'ASC']);
        $result = $this->Pagination->paginate($query);

        $this->set($result);
        $this->viewBuilder()->setOption('serialize', ['data', 'meta']);
    }

    /**
     * `PATCH /api/admin/users/:id` — partial patch of the four quota columns
     * and/or `is_admin` (promote/demote). Only fields present in the request
     * body are touched.
     *
     * @param string $id `users.id` (UUID), from the route.
     * @return void
     */
    public function edit(string $id): void
    {
        $this->request->allowMethod('PATCH');

        $usersTable = $this->fetchTable('Users');
        $user = $usersTable->get($id);

        $data = array_intersect_key($this->request->getData(), array_flip([
            'max_orgs', 'max_boards_per_org', 'max_lists_per_board', 'max_cards_per_board', 'is_admin',
        ]));

        $usersTable->patchEntity($user, $data);
        $diff = $this->auditLog->diffForUpdate($user);
        $usersTable->saveOrFail($user);

        $this->auditLog->write((string)$this->identity()->id, null, 'user', (string)$user->id, 'update', $diff);

        $this->set('user', $user);
        $this->viewBuilder()->setOption('serialize', 'user');
    }

    /**
     * @return void
     * @throws \App\Exception\ApiException 403 `not_admin` if the caller isn't a platform admin.
     */
    private function assertAdmin(): void
    {
        if (!$this->identity()->is_admin) {
            throw new ApiException('You are not an administrator.', 'not_admin', 403);
        }
    }

    /**
     * @return \App\Model\Entity\User
     */
    private function identity(): User
    {
        /** @var \App\Model\Entity\User */
        return $this->request->getAttribute('identity');
    }
}
