<?php
declare(strict_types=1);

namespace App\Controller;

use App\Exception\ApiException;
use App\Model\Entity\AuditLog;
use App\Model\Entity\User;
use App\Service\OrgAuthorizationService;
use Cake\ORM\Query\SelectQuery;

/**
 * Two-tier audit trail reads (planning/api-contract.md#admin):
 * - `GET /api/admin/audit-logs` — platform admins, every org.
 * - `GET /api/orgs/:id/audit-logs` — that org's owner only, scoped to it.
 */
class AuditLogsController extends AppController
{
    private OrgAuthorizationService $orgAuth;

    /**
     * @return void
     */
    public function initialize(): void
    {
        parent::initialize();

        $this->loadComponent('Pagination');
        $this->viewBuilder()->setClassName('Json');

        $this->orgAuth = new OrgAuthorizationService();
    }

    /**
     * `GET /api/admin/audit-logs` — every audit log row, paginated,
     * admin-gated.
     *
     * @return void
     */
    public function adminIndex(): void
    {
        $this->request->allowMethod('GET');

        if (!$this->identity()->is_admin) {
            throw new ApiException('You are not an administrator.', 'not_admin', 403);
        }

        $this->paginateAuditLogs($this->fetchTable('AuditLogs')->find());
    }

    /**
     * `GET /api/orgs/:id/audit-logs` — audit log rows scoped to one org,
     * paginated, owner-gated.
     *
     * @param string $orgId `organizations.id` (UUID), from the route.
     * @return void
     */
    public function orgIndex(string $orgId): void
    {
        $this->request->allowMethod('GET');

        $user = $this->identity();
        /** @var \App\Model\Entity\Organization $org */
        $org = $this->fetchTable('Organizations')->get($orgId);

        if (!$this->orgAuth->isOrgOwner((string)$user->id, (string)$org->id)) {
            throw new ApiException(
                'Only the organization owner can view its audit log.',
                'not_org_owner',
                403,
            );
        }

        $this->paginateAuditLogs(
            $this->fetchTable('AuditLogs')->find()->where(['org_id' => $org->id]),
        );
    }

    /**
     * @param \Cake\ORM\Query\SelectQuery $query Unpaginated AuditLogs query.
     * @return void
     */
    private function paginateAuditLogs(SelectQuery $query): void
    {
        $query = $query
            ->contain(['Actors' => function ($q) {
                return $q->select(['id', 'email', 'display_name']);
            }])
            ->orderBy(['AuditLogs.created' => 'DESC']);

        $result = $this->Pagination->paginate($query);
        $result['data'] = array_map(
            fn(AuditLog $log): array => $this->serializeAuditLog($log),
            iterator_to_array($result['data']),
        );

        $this->set($result);
        $this->viewBuilder()->setOption('serialize', ['data', 'meta']);
    }

    /**
     * @param \App\Model\Entity\AuditLog $log The audit log row.
     * @return array<string, mixed>
     */
    private function serializeAuditLog(AuditLog $log): array
    {
        return [
            'id' => $log->id,
            'actor' => $log->actor?->toArray(),
            'org_id' => $log->org_id,
            'resource_type' => $log->resource_type,
            'resource_id' => $log->resource_id,
            'action' => $log->action,
            'changes' => json_decode($log->changes, true),
            'created' => $log->created,
        ];
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
